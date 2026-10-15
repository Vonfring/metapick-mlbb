import { describe, expect, it, vi } from "vitest";
import type { HeroRow, HeroStatRow, ItemRow, PairRow } from "@/types/data";
import { PERIODS, RANK_BRACKETS } from "@/types/domain";
import { SourceBlockedError, SourceRequestError } from "../source/client";
import { contentHash } from "../source/normalize";
import type { ParsedStats } from "../source/transform/stats";
import type { ParsedCatalog } from "../source/transform/liquipedia";
import {
  MINIMUM_ROWS,
  runCatalogJob,
  syncHeroes,
  type CatalogDeps,
} from "./catalog-job";
import type { HeroCatalog } from "./official";
import {
  exitCode,
  newReport,
  renderSummary,
  rowsWritten,
  runStatus,
  type JobReport,
} from "./report";
import { revalidateSite } from "./revalidate";
import {
  createDryRunStore,
  snapshotKey,
  type StoreReader,
  type UpdaterStore,
} from "./store";
import { runStatsJob, type StatsDeps } from "./stats-job";

const FETCHED_AT = "2026-10-15T03:17:00.000Z";

/** An in-memory reader plus spies on every write. */
function fakeStore(reader: Partial<StoreReader> = {}) {
  const base = createDryRunStore({
    knownHeroIds: async () => new Set<number>(),
    latestSnapshotHashes: async () => new Map(),
    sourceHashes: async () => new Map(),
    activeIds: async () => [],
    allIds: async () => [],
    heroIdsWithTags: async () => new Set<number>(),
    ...reader,
  });
  const spy = <K extends keyof UpdaterStore>(name: K) =>
    vi.fn(base[name] as never) as never;
  return {
    ...base,
    writeSnapshot: spy("writeSnapshot"),
    pruneStats: vi.fn(async () => ({ snapshots: 0 })),
    upsertHeroes: spy("upsertHeroes"),
    replaceHeroDetails: spy("replaceHeroDetails"),
    saveSourceHashes: spy("saveSourceHashes"),
    dropSourceHashes: spy("dropSourceHashes"),
    deactivate: spy("deactivate"),
    upsertCatalog: spy("upsertCatalog"),
    deleteCatalog: spy("deleteCatalog"),
    insertTags: spy("insertTags"),
  } satisfies UpdaterStore;
}

const heroIds = Array.from({ length: 120 }, (_, i) => i + 1);

function statsFor(ids: number[]): ParsedStats {
  const stats: HeroStatRow[] = ids.map((id) => ({
    hero_id: id,
    win_rate: 0.5,
    pick_rate: 1 / ids.length,
    ban_rate: 0.01,
  }));
  const pairs: PairRow[] = ids
    .slice(0, 3)
    .map((id) => ({ hero_id: id, other_id: id + 1, win_rate_delta: 0.02 }));
  return { stats, pairs, skipped: 0 };
}

function statsDeps(
  overrides: Partial<StatsDeps> = {},
): StatsDeps & { store: ReturnType<typeof fakeStore> } {
  const store = fakeStore({ knownHeroIds: async () => new Set(heroIds) });
  return {
    store,
    report: newReport("stats", false, FETCHED_AT),
    fetchedAt: FETCHED_AT,
    runId: 7,
    fetchStats: async () => statsFor(heroIds),
    refreshHeroes: async () => new Set(heroIds),
    ...overrides,
  } as StatsDeps & { store: ReturnType<typeof fakeStore> };
}

describe("stats job", () => {
  it("writes every snapshot, with pairs only for the 7-day period", async () => {
    const deps = statsDeps();
    await runStatsJob(deps);
    const total = RANK_BRACKETS.length * PERIODS.length;
    expect(
      deps.report.entries.filter((e) => e.outcome === "written"),
    ).toHaveLength(total);
    const payloads = (
      deps.store.writeSnapshot as ReturnType<typeof vi.fn>
    ).mock.calls.map((c) => c[0]);
    expect(payloads[0]).toMatchObject({
      snapshot_date: "2026-10-15",
      run_id: 7,
      matchups: [],
      synergies: [],
    });
    const weekly = payloads.find((p) => p.period_days === 7);
    expect(weekly.matchups).toHaveLength(3);
    expect(weekly.synergies).toHaveLength(3);
    expect(runStatus(deps.report)).toBe("success");
    expect(deps.store.pruneStats).toHaveBeenCalledWith(120);
  });

  it("skips snapshots whose hash matches the newest one", async () => {
    const same = statsFor(heroIds);
    const hash = contentHash({
      stats: same.stats,
      matchups: undefined,
      synergies: undefined,
    });
    const deps = statsDeps();
    deps.store.latestSnapshotHashes = async () =>
      new Map([[snapshotKey("mythic", 30), hash]]);
    await runStatsJob(deps);
    expect(
      deps.report.entries.find((e) => e.key === "mythic/30d")?.outcome,
    ).toBe("unchanged");
    expect(deps.store.writeSnapshot).toHaveBeenCalledTimes(
      RANK_BRACKETS.length * PERIODS.length - 1,
    );
  });

  it("reports skipped when nothing changed at all", async () => {
    const deps = statsDeps();
    const latest = new Map<string, string>();
    for (const bracket of RANK_BRACKETS) {
      for (const period of PERIODS) {
        const s = statsFor(heroIds);
        latest.set(
          snapshotKey(bracket, period),
          contentHash(
            period === 7
              ? { stats: s.stats, matchups: s.pairs, synergies: s.pairs }
              : { stats: s.stats, matchups: undefined, synergies: undefined },
          ),
        );
      }
    }
    deps.store.latestSnapshotHashes = async () => latest;
    await runStatsJob(deps);
    expect(deps.store.writeSnapshot).not.toHaveBeenCalled();
    expect(runStatus(deps.report)).toBe("skipped");
    expect(exitCode(deps.report)).toBe(0);
  });

  it("skips a snapshot that fails the sanity checks and carries on", async () => {
    const deps = statsDeps({
      fetchStats: async (bracket, period) =>
        bracket === "epic" && period === 1
          ? statsFor(heroIds.slice(0, 10))
          : statsFor(heroIds),
    });
    await runStatsJob(deps);
    expect(deps.report.entries.find((e) => e.key === "epic/1d")).toMatchObject({
      outcome: "skipped",
    });
    expect(runStatus(deps.report)).toBe("partial");
    expect(exitCode(deps.report)).toBe(0);
  });

  it("stops requesting after the firewall blocks the run", async () => {
    let calls = 0;
    const deps = statsDeps({
      fetchStats: async () => {
        calls += 1;
        if (calls === 3) throw new SourceBlockedError("blocked twice");
        return statsFor(heroIds);
      },
    });
    await runStatsJob(deps);
    expect(calls).toBe(3);
    expect(deps.report.blocked).toBe(true);
    expect(deps.report.entries.at(-1)?.reason).toMatch(/not requested/);
    expect(runStatus(deps.report)).toBe("partial");
    expect(exitCode(deps.report)).toBe(1);
  });

  it("fails when every snapshot errors", async () => {
    const deps = statsDeps({
      fetchStats: async () => {
        throw new SourceRequestError("HTTP 500 from the source", 500);
      },
    });
    await runStatsJob(deps);
    expect(runStatus(deps.report)).toBe("failed");
    expect(exitCode(deps.report)).toBe(1);
  });

  it("refreshes the hero list once for unknown heroes, then leaves out the rest", async () => {
    const withNew = [...heroIds, 500, 501];
    const refreshHeroes = vi.fn(async () => new Set([...heroIds, 500]));
    const deps = statsDeps({
      fetchStats: async () => statsFor(withNew),
      refreshHeroes,
    });
    await runStatsJob(deps);
    expect(refreshHeroes).toHaveBeenCalledTimes(1);
    const payload = (deps.store.writeSnapshot as ReturnType<typeof vi.fn>).mock
      .calls[0]![0];
    expect(payload.stats.map((s: HeroStatRow) => s.hero_id)).toContain(500);
    expect(payload.stats.map((s: HeroStatRow) => s.hero_id)).not.toContain(501);
    expect(deps.report.warnings.some((w) => w.includes("501"))).toBe(true);
  });
});

const hero = (id: number, over: Partial<HeroRow> = {}): HeroRow => ({
  id,
  slug: `hero-${id}`,
  name: `Hero ${id}`,
  roles: ["fighter"],
  lanes: ["exp"],
  specialties: [],
  durability: null,
  offense: null,
  control_effect: null,
  difficulty: null,
  lore: null,
  head_image_url: null,
  portrait_image_url: null,
  ...over,
});

function heroCatalog(count: number): HeroCatalog {
  const heroes = Array.from({ length: count }, (_, i) => hero(i + 1));
  return {
    heroes,
    skills: heroes.map((h) => ({
      hero_id: h.id,
      slot: 0,
      source_skill_id: null,
      name: "Passive",
      description: "Does things",
      cooldown: null,
      cost: null,
      tags: [],
      icon_url: null,
    })),
    relations: [
      {
        hero_id: 1,
        relation: "best_teammate",
        target_hero_id: 2,
        description: null,
      },
    ],
    warnings: [],
  };
}

const item = (id: number, slug = `item-${id}`): ItemRow => ({
  id,
  slug,
  name: `Item ${id}`,
  category: "attack",
  other_categories: [],
  tier: 3,
  price: 1000,
  attributes: [],
  passives: [],
  builds_into: [],
  icon_url: null,
});

function wikiCatalog(): ParsedCatalog {
  return {
    items: Array.from({ length: MINIMUM_ROWS.items }, (_, i) => item(1000 + i)),
    emblems: Array.from({ length: 7 }, (_, i) => ({
      id: 2000 + i,
      slug: `set-${i}`,
      name: `Set ${i}`,
      attributes: [],
      icon_url: null,
      recommended_roles: [],
      sort_order: i,
    })),
    talents: Array.from({ length: 21 }, (_, i) => ({
      id: 3000 + i,
      emblem_id: 2000 + (i % 7),
      name: `Talent ${i}`,
      tier: (i % 3) + 1,
      description: "x",
      icon_url: null,
      sort_order: i,
    })),
    spells: Array.from({ length: 12 }, (_, i) => ({
      id: 4000 + i,
      slug: `spell-${i}`,
      name: `Spell ${i}`,
      description: "x",
      short_description: null,
      icon_url: null,
      sort_order: i,
    })),
    revisedAt: null,
    warnings: [],
  };
}

function catalogDeps(
  overrides: Partial<CatalogDeps> = {},
  reader: Partial<StoreReader> = {},
) {
  const store = fakeStore(reader);
  const deps: CatalogDeps & { store: ReturnType<typeof fakeStore> } = {
    store,
    report: newReport("catalog", false, FETCHED_AT),
    fetchedAt: FETCHED_AT,
    fetchHeroes: async () => heroCatalog(105),
    fetchWiki: async () => wikiCatalog(),
    loadTags: async () => ({}),
    loadItemOverrides: async () => ({}),
    ...overrides,
  } as CatalogDeps & { store: ReturnType<typeof fakeStore> };
  return deps;
}

const callArg = (fn: unknown, call = 0, arg = 0) =>
  (fn as ReturnType<typeof vi.fn>).mock.calls[call]![arg];

describe("catalog job", () => {
  it("writes only heroes whose source data changed since the last run", async () => {
    const catalog = heroCatalog(105);
    const first = catalog.heroes[0]!;
    const unchangedHash = contentHash({
      hero: first,
      skills: catalog.skills.filter((s) => s.hero_id === first.id),
      relations: catalog.relations,
    });
    const deps = catalogDeps(
      {},
      {
        sourceHashes: async (kind) =>
          new Map(kind === "hero" ? [["1", unchangedHash]] : []),
      },
    );
    await syncHeroes(deps);
    const written = callArg(deps.store.upsertHeroes) as HeroRow[];
    expect(written).toHaveLength(104);
    expect(written.map((h) => h.id)).not.toContain(1);
    expect(written[0]).toMatchObject({
      is_active: true,
      source_updated_at: FETCHED_AT,
    });
  });

  it("marks heroes that left the source inactive and forgets their hash", async () => {
    const deps = catalogDeps({}, { activeIds: async () => [1, 2, 999] });
    await syncHeroes(deps);
    expect(deps.store.deactivate).toHaveBeenCalledWith("heroes", [999]);
    expect(deps.store.dropSourceHashes).toHaveBeenCalledWith("hero", ["999"]);
  });

  it("leaves the heroes alone when too few parsed", async () => {
    const deps = catalogDeps({ fetchHeroes: async () => heroCatalog(20) });
    await syncHeroes(deps);
    expect(deps.store.upsertHeroes).not.toHaveBeenCalled();
    expect(deps.store.deactivate).not.toHaveBeenCalled();
    expect(deps.report.entries[0]).toMatchObject({
      key: "heroes",
      outcome: "skipped",
    });
  });

  it("inserts tags only for heroes without any and lists the heroes still missing them", async () => {
    const tags = {
      "hero-1": {
        damage_type: "physical" as const,
        frontline: 1,
        hard_cc: 0,
        peel: 0,
        aoe_damage: 0,
        pickoff: 0,
        push: 0,
        mobility: 0,
        sustain: 0,
        burst: 0,
        scaling: 0,
      },
      "hero-2": {
        damage_type: "magic" as const,
        frontline: 0,
        hard_cc: 2,
        peel: 0,
        aoe_damage: 0,
        pickoff: 0,
        push: 0,
        mobility: 0,
        sustain: 0,
        burst: 0,
        scaling: 0,
      },
    };
    const tagged = new Set(Array.from({ length: 103 }, (_, i) => i + 2));
    const deps = catalogDeps(
      { loadTags: async () => tags },
      { heroIdsWithTags: async () => tagged },
    );
    await syncHeroes(deps);
    expect(callArg(deps.store.insertTags)).toEqual([
      { ...tags["hero-1"], hero_id: 1, needs_review: false, notes: null },
    ]);
    expect(deps.report.warnings.join(" ")).toMatch(
      /No team tags yet for Hero 105/,
    );
  });

  it("applies item overrides, skips talents when the sets fail, and deletes spells that left the source", async () => {
    const wiki = wikiCatalog();
    wiki.emblems = wiki.emblems.slice(0, 3);
    const deps = catalogDeps(
      {
        fetchWiki: async () => wiki,
        loadItemOverrides: async () => ({ "item-1000": { price: 2010 } }),
      },
      {
        allIds: async (table) =>
          table === "battle_spells" ? [4000, 4999] : [],
      },
    );
    await runCatalogJob(deps);
    const items = callArg(deps.store.upsertCatalog, 0, 1) as ItemRow[];
    expect(items.find((i) => i.slug === "item-1000")).toMatchObject({
      price: 2010,
      is_active: true,
    });
    expect(
      deps.report.entries.find((e) => e.key === "emblem sets"),
    ).toMatchObject({ outcome: "skipped" });
    expect(deps.report.entries.find((e) => e.key === "talents")).toMatchObject({
      outcome: "skipped",
    });
    expect(deps.store.deleteCatalog).toHaveBeenCalledWith(
      "battle_spells",
      [4999],
    );
    expect(runStatus(deps.report)).toBe("partial");
  });

  it("still updates Liquipedia data when the official source blocks the run", async () => {
    const deps = catalogDeps({
      fetchHeroes: async () => {
        throw new SourceBlockedError("blocked twice");
      },
    });
    await runCatalogJob(deps);
    expect(deps.report.blocked).toBe(true);
    expect(deps.store.upsertCatalog).toHaveBeenCalled();
    expect(exitCode(deps.report)).toBe(1);
  });
});

describe("report", () => {
  const report = (): JobReport => newReport("stats", false, FETCHED_AT);

  it("counts written rows and escapes table cells", () => {
    const r = report();
    r.entries.push({
      key: "a|b",
      outcome: "written",
      rows: 5,
      reason: "line\nbreak",
    });
    expect(rowsWritten(r)).toBe(5);
    expect(renderSummary(r)).toContain("| a\\|b | written | 5 | line break |");
  });

  it("treats a crash after writes as partial, and a crash before as failed", () => {
    const r = report();
    r.fatal = "boom";
    expect(runStatus(r)).toBe("failed");
    r.entries.push({ key: "x", outcome: "written", rows: 1 });
    expect(runStatus(r)).toBe("partial");
    expect(exitCode(r)).toBe(1);
  });
});

describe("revalidateSite", () => {
  it("does nothing without a site URL or secret", async () => {
    const fetchImpl = vi.fn();
    expect(await revalidateSite(undefined, "s", fetchImpl)).toEqual({
      result: "not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the secret as a bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    expect(
      await revalidateSite("https://example.test", "s3cret", fetchImpl),
    ).toEqual({ result: "done" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(String(url)).toBe("https://example.test/api/revalidate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s3cret",
    );
  });

  it("reports a failed request without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    expect(
      await revalidateSite("https://example.test", "s", fetchImpl),
    ).toEqual({ result: "failed", detail: "HTTP 401" });
  });
});
