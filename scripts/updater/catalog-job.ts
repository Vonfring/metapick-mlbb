/**
 * Weekly catalog job: official heroes, plus items, emblems, talents and
 * battle spells from Liquipedia. A row is written only when its source data
 * changed since the last run (source_hashes), so fixes made in the Table
 * Editor stay until the source itself changes that row.
 */
import { z } from "zod";
import {
  battleSpellRowSchema,
  emblemRowSchema,
  emblemTalentRowSchema,
  itemRowSchema,
} from "@/lib/data/schemas";
import type { HeroTagRow, HeroTagValues, ItemRow } from "@/types/data";
import { SourceBlockedError } from "../source/client";
import { contentHash } from "../source/normalize";
import type { ParsedCatalog } from "../source/transform/liquipedia";
import type { HeroCatalog } from "./official";
import type { JobReport } from "./report";
import type {
  CatalogKind,
  CatalogRowOf,
  CatalogTable,
  UpdaterStore,
} from "./store";

/** Fewer rows than this means the source broke, so the job leaves that table alone. */
export const MINIMUM_ROWS = {
  heroes: 100,
  items: 80,
  emblems: 7,
  talents: 20,
  spells: 10,
} as const;

export type CatalogDeps = {
  store: UpdaterStore;
  report: JobReport;
  fetchedAt: string;
  fetchHeroes: () => Promise<HeroCatalog>;
  fetchWiki: () => Promise<ParsedCatalog>;
  /** seed/hero-tags.json, keyed by hero slug. */
  loadTags: () => Promise<Record<string, HeroTagValues>>;
  /** seed/overrides/items.json, keyed by item slug. */
  loadItemOverrides: () => Promise<Record<string, Partial<ItemRow>>>;
};

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type Hashed<T> = { id: number; row: T; hash: string };

/** Splits rows into those whose hash differs from the last run and those that match. */
async function changedRows<T>(
  store: UpdaterStore,
  kind: CatalogKind,
  rows: Hashed<T>[],
) {
  const previous = await store.sourceHashes(kind);
  return rows.filter((r) => previous.get(String(r.id)) !== r.hash);
}

const summary = (parts: [number, string][]) =>
  parts
    .filter(([n]) => n > 0)
    .map(([n, what]) => `${n} ${what}`)
    .join(", ");

/**
 * Heroes with their skills and official relations. Also inserts team tags
 * from seed/hero-tags.json for heroes that have none yet. Returns the ID of
 * every hero the database knows afterwards.
 */
export async function syncHeroes(deps: CatalogDeps): Promise<Set<number>> {
  const { store, report, fetchedAt } = deps;
  const knownBefore = await store.knownHeroIds();
  let catalog: HeroCatalog;
  try {
    catalog = await deps.fetchHeroes();
  } catch (error) {
    report.entries.push({
      key: "heroes",
      outcome: "skipped",
      reason: errorText(error),
    });
    throw error;
  }
  report.warnings.push(...catalog.warnings);
  if (catalog.heroes.length < MINIMUM_ROWS.heroes) {
    report.entries.push({
      key: "heroes",
      outcome: "skipped",
      reason: `only ${catalog.heroes.length} heroes parsed, expected at least ${MINIMUM_ROWS.heroes}`,
    });
    return knownBefore;
  }

  const fetchedIds = new Set(catalog.heroes.map((h) => h.id));
  const targets = new Set([...knownBefore, ...fetchedIds]);
  const hashed = catalog.heroes.map((hero) => {
    const skills = catalog.skills.filter((s) => s.hero_id === hero.id);
    const relations = catalog.relations.filter(
      (r) =>
        r.hero_id === hero.id &&
        r.target_hero_id !== hero.id &&
        targets.has(r.target_hero_id),
    );
    return {
      id: hero.id,
      row: { hero, skills, relations },
      hash: contentHash({ hero, skills, relations }),
    };
  });
  const changed = await changedRows(store, "hero", hashed);
  const created = changed.filter((c) => !knownBefore.has(c.id)).length;

  // Every changed hero row first, so relations can point at new heroes.
  await store.upsertHeroes(
    changed.map((c) => ({
      ...c.row.hero,
      is_active: true,
      source_updated_at: fetchedAt,
    })),
  );
  await store.replaceHeroDetails(
    changed.map((c) => ({
      heroId: c.id,
      skills: c.row.skills,
      relations: c.row.relations,
    })),
  );
  await store.saveSourceHashes(
    "hero",
    changed.map((c) => ({ id: String(c.id), hash: c.hash })),
  );

  // Heroes the source no longer lists stay in the database, inactive; their
  // hash is dropped so a returning hero is written again.
  const gone = (await store.activeIds("heroes")).filter(
    (id) => !fetchedIds.has(id),
  );
  await store.deactivate("heroes", gone);
  await store.dropSourceHashes("hero", gone.map(String));

  const rows = changed.reduce(
    (sum, c) => sum + 1 + c.row.skills.length + c.row.relations.length,
    0,
  );
  report.entries.push(
    changed.length + gone.length > 0
      ? {
          key: "heroes",
          outcome: "written",
          rows: rows + gone.length,
          reason: summary([
            [created, "new"],
            [changed.length - created, "changed"],
            [gone.length, "marked inactive"],
          ]),
        }
      : {
          key: "heroes",
          outcome: "unchanged",
          reason: `${catalog.heroes.length} heroes`,
        },
  );

  // Team tags: insert only, never update, so Table Editor edits stay.
  const tags = await deps.loadTags();
  const tagged = await store.heroIdsWithTags();
  const newTags: HeroTagRow[] = catalog.heroes
    .filter((h) => !tagged.has(h.id) && h.slug in tags)
    .map((h) => {
      const values = tags[h.slug]!;
      return {
        ...values,
        hero_id: h.id,
        needs_review: values.needs_review ?? false,
        notes: values.notes ?? null,
      };
    });
  await store.insertTags(newTags);
  if (newTags.length > 0) {
    report.entries.push({
      key: "team tags",
      outcome: "written",
      rows: newTags.length,
      reason: "from seed/hero-tags.json",
    });
  }
  const untagged = catalog.heroes
    .filter((h) => !tagged.has(h.id) && !(h.slug in tags))
    .map((h) => h.name);
  if (untagged.length > 0) {
    report.warnings.push(
      `No team tags yet for ${untagged.join(", ")}. Add them in seed/hero-tags.json or the Table Editor.`,
    );
  }

  return new Set([...knownBefore, ...fetchedIds]);
}

type WikiTable = {
  table: CatalogTable;
  kind: CatalogKind;
  label: string;
  minimum: number;
  schema: z.ZodType;
};

const WIKI_TABLES = {
  items: {
    table: "items",
    kind: "item",
    label: "items",
    minimum: MINIMUM_ROWS.items,
    schema: itemRowSchema,
  },
  emblems: {
    table: "emblems",
    kind: "emblem",
    label: "emblem sets",
    minimum: MINIMUM_ROWS.emblems,
    schema: emblemRowSchema,
  },
  talents: {
    table: "emblem_talents",
    kind: "talent",
    label: "talents",
    minimum: MINIMUM_ROWS.talents,
    schema: emblemTalentRowSchema,
  },
  spells: {
    table: "battle_spells",
    kind: "spell",
    label: "battle spells",
    minimum: MINIMUM_ROWS.spells,
    schema: battleSpellRowSchema,
  },
} as const satisfies Record<string, WikiTable>;

/** Writes one Liquipedia table. Returns false when it was skipped. */
async function syncWikiTable<T extends CatalogTable>(
  deps: CatalogDeps,
  spec: WikiTable & { table: T },
  rows: CatalogRowOf[T][],
): Promise<boolean> {
  const { store, report } = deps;
  const valid = z.array(spec.schema).safeParse(rows);
  if (!valid.success) {
    const issue = valid.error.issues[0];
    report.entries.push({
      key: spec.label,
      outcome: "skipped",
      reason: `unexpected data at ${issue?.path.join(".") ?? "?"}: ${issue?.message ?? "invalid"}`,
    });
    return false;
  }
  if (rows.length < spec.minimum) {
    report.entries.push({
      key: spec.label,
      outcome: "skipped",
      reason: `only ${rows.length} parsed, expected at least ${spec.minimum}`,
    });
    return false;
  }

  const changed = await changedRows(
    store,
    spec.kind,
    rows.map((row) => ({ id: row.id, row, hash: contentHash(row) })),
  );
  await store.upsertCatalog(
    spec.table,
    changed.map((c) => c.row),
  );
  await store.saveSourceHashes(
    spec.kind,
    changed.map((c) => ({ id: String(c.id), hash: c.hash })),
  );

  const fetchedIds = new Set(rows.map((r) => r.id));
  let removed: number[];
  if (spec.table === "items") {
    removed = (await store.activeIds("items")).filter(
      (id) => !fetchedIds.has(id),
    );
    await store.deactivate("items", removed);
  } else {
    removed = (await store.allIds(spec.table)).filter(
      (id) => !fetchedIds.has(id),
    );
    await store.deleteCatalog(spec.table, removed);
  }
  await store.dropSourceHashes(spec.kind, removed.map(String));

  report.entries.push(
    changed.length + removed.length > 0
      ? {
          key: spec.label,
          outcome: "written",
          rows: changed.length + removed.length,
          reason: summary([
            [changed.length, "new or changed"],
            [
              removed.length,
              spec.table === "items" ? "marked inactive" : "removed",
            ],
          ]),
        }
      : {
          key: spec.label,
          outcome: "unchanged",
          reason: `${rows.length} rows`,
        },
  );
  return true;
}

/** Items, emblem sets, talents and battle spells from Liquipedia. */
export async function syncWiki(deps: CatalogDeps): Promise<void> {
  const { report } = deps;
  let parsed: ParsedCatalog;
  try {
    parsed = await deps.fetchWiki();
  } catch (error) {
    report.entries.push({
      key: "Liquipedia",
      outcome: "skipped",
      reason: errorText(error),
    });
    return;
  }
  report.warnings.push(...parsed.warnings);

  // The same corrections the seed applies (seed/overrides/items.json).
  const overrides = await deps.loadItemOverrides();
  const items: ItemRow[] = parsed.items.map((item) => ({
    ...item,
    ...overrides[item.slug],
    is_active: true,
  }));

  await syncWikiTable(deps, WIKI_TABLES.items, items);
  const emblemsOk = await syncWikiTable(
    deps,
    WIKI_TABLES.emblems,
    parsed.emblems,
  );
  if (emblemsOk) await syncWikiTable(deps, WIKI_TABLES.talents, parsed.talents);
  else
    report.entries.push({
      key: "talents",
      outcome: "skipped",
      reason: "the emblem sets were skipped",
    });
  await syncWikiTable(deps, WIKI_TABLES.spells, parsed.spells);
}

export async function runCatalogJob(deps: CatalogDeps): Promise<void> {
  try {
    await syncHeroes(deps);
  } catch (error) {
    // Already in the report. Liquipedia is a different source, so carry on.
    if (error instanceof SourceBlockedError) deps.report.blocked = true;
  }
  await syncWiki(deps);
}
