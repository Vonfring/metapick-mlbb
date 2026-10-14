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

function input(overrides: Partial<SeedInput["official"]> = {}): SeedInput {
  return {
    official: {
      meta: { fetched_at: "2026-10-14T03:00:00Z", source: "test" },
      heroes: [hero(1, "miya", "Miya"), hero(2, "yi-sun-shin", "Yi Sun-shin")],
      skills: [],
      relations: [],
      items: [],
      emblems: [],
      talents: [],
      spells: [],
      builds: [],
      snapshots: [],
      ...overrides,
    },
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
});
