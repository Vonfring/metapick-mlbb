import { describe, expect, it } from "vitest";
import type { HeroTagValues } from "@/types/data";
import type { HeroLane } from "@/types/domain";
import { coverLanes, evaluateComposition } from "./composition";
import { buildHeroIndex } from "./hero-index";
import { heroMatchup, teamMatchup, teamSynergies, verdictFor } from "./matchup";

const levels = (values: Partial<HeroTagValues>): HeroTagValues => ({
  damage_type: "physical",
  frontline: 0,
  hard_cc: 0,
  peel: 0,
  aoe_damage: 0,
  pickoff: 0,
  push: 0,
  mobility: 0,
  sustain: 0,
  burst: 0,
  scaling: 1,
  ...values,
});

describe("verdictFor", () => {
  it("reads small totals as even and caps the estimate", () => {
    expect(verdictFor(0.5)).toMatchObject({
      favored: null,
      strength: "even",
      estimate: 50,
    });
    expect(verdictFor(2)).toMatchObject({
      favored: "first",
      strength: "slight",
      estimate: 52,
    });
    expect(verdictFor(-5)).toMatchObject({
      favored: "second",
      strength: "clear",
      estimate: 45,
    });
    expect(verdictFor(30).estimate).toBe(70);
    expect(verdictFor(-30).estimate).toBe(30);
  });
});

describe("coverLanes", () => {
  const member = (id: number, lanes: HeroLane[]) => ({ id, lanes });

  it("moves a flexible hero to free a lane for another", () => {
    // Hero 1 can play EXP or jungle; hero 2 only jungle.
    expect(
      coverLanes([member(1, ["jungle", "exp"]), member(2, ["jungle"])]),
    ).toEqual({ covered: 2, open: ["mid", "roam", "gold"] });
  });

  it("counts heroes fighting over one lane once", () => {
    expect(coverLanes([member(1, ["gold"]), member(2, ["gold"])]).covered).toBe(
      1,
    );
  });
});

describe("evaluateComposition", () => {
  const lanes: HeroLane[] = ["exp", "mid", "roam", "jungle", "gold"];

  it("passes a balanced team and flags what a skewed one lacks", () => {
    const balanced = new Map<number, HeroTagValues>([
      [1, levels({ frontline: 2, hard_cc: 1, push: 1, sustain: 2 })],
      [
        2,
        levels({ damage_type: "magic", aoe_damage: 3, hard_cc: 2, scaling: 2 }),
      ],
      [3, levels({ frontline: 3, hard_cc: 3, peel: 3, damage_type: "magic" })],
      [4, levels({ pickoff: 3, burst: 3, mobility: 3, aoe_damage: 1 })],
      [5, levels({ push: 3, scaling: 3, aoe_damage: 1, pickoff: 2 })],
    ]);
    const team = lanes.map((lane, i) => ({ id: i + 1, lanes: [lane] }));
    const report = evaluateComposition(team, balanced);
    expect(report.complete).toBe(true);
    const status = Object.fromEntries(
      report.checks.map((c) => [c.id, c.status]),
    );
    expect(status).toEqual({
      lanes: "ok",
      frontline: "ok", // 2 + 3
      hard_cc: "ok", // 1 + 2 + 3
      damage_mix: "ok", // 3 physical, 2 magic
      peel: "ok",
      aoe_damage: "ok", // 3 + 1 + 1
      pickoff: "ok", // 3 + 2
      push: "ok", // 1 + 3
      scaling: "ok", // 1 + 2 + 1 + 1 + 3
    });
    expect(report.score).toBe(1);

    const allPhysical = new Map(
      [...balanced].map(([id, t]) => [
        id,
        { ...t, damage_type: "physical" as const },
      ]),
    );
    const skewed = evaluateComposition(
      team.map((m) => ({ ...m, lanes: ["gold" as HeroLane] })),
      allPhysical,
    );
    const lanesCheck = skewed.checks.find((c) => c.id === "lanes")!;
    expect(lanesCheck).toMatchObject({ status: "missing", covered: 1 });
    expect(skewed.checks.find((c) => c.id === "damage_mix")!.status).toBe(
      "missing",
    );
    // Lanes (2) and damage (1.5) fail out of a total weight of 12.5.
    expect(skewed.score).toBeCloseTo(9 / 12.5, 10);
  });
});

describe("heroMatchup and teamMatchup", () => {
  const tags = [
    { hero_id: 1, ...levels({ hard_cc: 3, frontline: 3 }) },
    { hero_id: 2, ...levels({ mobility: 3, burst: 3 }) },
    { hero_id: 3, ...levels({ damage_type: "magic" }) },
    { hero_id: 4, ...levels({ damage_type: "magic" }) },
  ];
  const idx = buildHeroIndex({
    heroes: [
      { id: 1, lanes: ["roam"] },
      { id: 2, lanes: ["jungle"] },
      { id: 3, lanes: ["mid"] },
      { id: 4, lanes: ["mid"] },
    ],
    stats: [
      { hero_id: 1, win_rate: 0.52, pick_rate: 0.02, ban_rate: 0 },
      { hero_id: 2, win_rate: 0.5, pick_rate: 0.02, ban_rate: 0 },
      { hero_id: 3, win_rate: 0.5, pick_rate: 0.02, ban_rate: 0 },
      { hero_id: 4, win_rate: 0.5, pick_rate: 0.02, ban_rate: 0 },
    ],
    matchups: [[2, 1, -0.03]],
    synergies: [
      [1, 3, 0.02],
      [3, 1, 0.02],
    ],
    tags,
    notes: [],
  });

  it("adds the meta difference to the edge between two heroes", () => {
    const result = heroMatchup(idx, 1, 2);
    // Stats +3, lockdown +1, burst −0.8 × 3/3 × 0/3 = 0 for hero 2.
    expect(result.edge.points.total).toBeCloseTo(4, 10);
    // (0.51818 − 0.5) × 100 × 0.3 − 0.
    expect(result.metaPoints).toBeCloseTo(0.5455, 4);
    expect(result.verdict).toMatchObject({
      favored: "first",
      strength: "clear",
    });
  });

  it("finds teammate pairs with data once", () => {
    expect(teamSynergies(idx, [1, 3])).toEqual([
      { heroId: 1, teammateId: 3, delta: 0.02 },
    ]);
  });

  it("weighs meta, counters and synergy, and skips composition until both teams are full", () => {
    const result = teamMatchup(idx, [1, 3], [2, 4]);
    expect(result.meta.blue).toBeCloseTo(1.818, 3);
    expect(result.meta.points).toBeCloseTo(1.818 * 0.3, 3);
    // 1 vs 2: 4. 3 vs 2: hero 2's burst against hero 3's missing
    // frontline, −0.8 × 3/3 × 3/3. The other pairs: 0.
    expect(result.counters.points).toBeCloseTo((4 - 0.8) * 0.5, 10);
    expect(result.counters.pairs[0]).toMatchObject({
      heroId: 1,
      opponentId: 2,
    });
    expect(result.synergy.points).toBeCloseTo(2 * 0.5, 10);
    expect(result.composition.points).toBeNull();
    expect(result.verdict.total).toBeCloseTo(0.5455 + 1.6 + 1, 3);
    expect(result.verdict.estimate).toBe(53);
  });
});
