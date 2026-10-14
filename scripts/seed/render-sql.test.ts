import { describe, expect, it } from "vitest";
import type { SeedInput } from "./files";
import { renderSeedSql } from "./render-sql";
import { literal, quote, textArray } from "./sql";

const hero = (id: number, slug: string, name: string) => ({
  id,
  slug,
  name,
  roles: ["marksman" as const],
  lanes: ["gold" as const],
  specialties: ["Reap", "Burst"],
  durability: 30,
  offense: 80,
  control_effect: 20,
  difficulty: 30,
  lore: "It's a hero's story.",
  head_image_url: "https://cdn.example/head.png",
  portrait_image_url: null,
});

const tags = {
  damage_type: "physical" as const,
  frontline: 0,
  hard_cc: 0,
  peel: 0,
  aoe_damage: 1,
  pickoff: 1,
  push: 3,
  mobility: 1,
  sustain: 1,
  burst: 1,
  scaling: 3,
};

function input(
  overrides: Partial<SeedInput["official"]> = {},
  catalog: Partial<SeedInput["catalog"]> = {},
): SeedInput {
  return {
    official: {
      meta: { fetched_at: "2026-10-14T03:00:00Z", source: "test" },
      heroes: [hero(1, "miya", "Miya"), hero(2, "yi-sun-shin", "Yi Sun-shin")],
      skills: [],
      relations: [],
      snapshots: [],
      ...overrides,
    },
    catalog: { meta: null, items: [], emblems: [], talents: [], spells: [], ...catalog },
    tags: { miya: tags, ghost: tags },
    itemOverrides: {},
  };
}

describe("sql helpers", () => {
  it("escapes quotes and renders nulls", () => {
    expect(quote("It's")).toBe("'It''s'");
    expect(literal(null)).toBe("null");
    expect(textArray([], "public.hero_lane").sql).toBe("'{}'::public.hero_lane[]");
    expect(() => literal(Number.NaN)).toThrow();
  });
});

describe("renderSeedSql", () => {
  it("wraps everything in one transaction and escapes text", () => {
    const { sql } = renderSeedSql(input());
    expect(sql.trimStart().startsWith("--")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql.trim().endsWith("commit;")).toBe(true);
    expect(sql).toContain("'It''s a hero''s story.'");
    expect(sql).toContain("array['marksman']::public.hero_role[]");
  });

  it("warns about tag entries without a hero and heroes without tags", () => {
    const { warnings, counts } = renderSeedSql(input());
    expect(counts.tags).toBe(1);
    expect(warnings).toContain('hero-tags.json: "ghost" does not match any hero slug, skipped');
    expect(warnings.some((w) => w.includes("no entry for: yi-sun-shin"))).toBe(true);
  });

  it("drops stat rows and pairs that reference unknown heroes", () => {
    const { counts, warnings } = renderSeedSql(
      input({
        snapshots: [
          {
            rank_bracket: "mythic",
            period_days: 7,
            snapshot_date: "2026-10-14",
            fetched_at: "2026-10-14T03:00:00Z",
            content_hash: "abc",
            stats: [
              { hero_id: 1, win_rate: 0.51, pick_rate: 0.02, ban_rate: 0.001 },
              { hero_id: 99, win_rate: 0.5, pick_rate: 0.01, ban_rate: 0 },
            ],
            matchups: [
              { hero_id: 1, other_id: 2, win_rate_delta: 0.02 },
              { hero_id: 1, other_id: 99, win_rate_delta: 0.01 },
            ],
          },
        ],
      }),
    );
    expect(counts.stats).toBe(1);
    expect(counts.matchups).toBe(1);
    expect(warnings.some((w) => w.includes("hero 99"))).toBe(true);
  });

  it("applies item overrides by slug and warns about unknown ones", () => {
    const item = {
      id: 501,
      slug: "blade-of-despair",
      name: "Blade of Despair",
      category: "attack" as const,
      other_categories: [],
      tier: 3,
      price: 3010,
      attributes: [{ label: "Physical Attack", value: "+160" }],
      passives: [],
      builds_into: [],
      icon_url: null,
    };
    const result = renderSeedSql({
      ...input({}, { items: [item] }),
      itemOverrides: { "blade-of-despair": { price: 2999 }, "no-such-item": { price: 1 } },
    });
    expect(result.counts.items).toBe(1);
    expect(result.sql).toContain("2999");
    expect(result.sql).not.toContain("3010");
    expect(result.warnings).toContain('overrides/items.json: "no-such-item" matches no item, skipped');
    expect(result.sql).toContain("-- No item, emblem, talent or spell catalog yet");
  });

  it("keeps header comments on one line whatever the metadata contains", () => {
    const { sql } = renderSeedSql(
      input({}, {
        meta: {
          fetched_at: "2026-10-14T03:00:00Z",
          source: "wiki\ndrop table public.heroes; --",
          license: "CC BY-SA 3.0",
          revised_at: null,
        },
      }),
    );
    expect(sql).not.toMatch(/^drop table/m);
    expect(sql).toContain("-- Items, emblems, talents and spells: wiki drop table public.heroes; --");
  });
});
