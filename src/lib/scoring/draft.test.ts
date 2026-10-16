import { describe, expect, it } from "vitest";
import type { HeroTagValues } from "@/types/data";
import type { HeroLane } from "@/types/domain";
import { evaluateComposition } from "./composition";
import {
  scorePick,
  suggestBans,
  suggestPicks,
  suggestSwaps,
  teamStrength,
} from "./draft";
import { buildHeroIndex } from "./hero-index";

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

const TANK = 1;
const MAGE = 2;
const MARKSMAN = 3;
const ASSASSIN = 4;
const FIGHTER = 5;
const MAGE_2 = 6;
const TANK_2 = 7;

const heroes: {
  id: number;
  lanes: HeroLane[];
  tags: HeroTagValues;
  wr: number;
}[] = [
  {
    id: TANK,
    lanes: ["roam"],
    tags: levels({ frontline: 3, hard_cc: 3, peel: 2 }),
    wr: 0.52,
  },
  {
    id: MAGE,
    lanes: ["mid"],
    tags: levels({ damage_type: "magic", aoe_damage: 3, burst: 2, hard_cc: 1 }),
    wr: 0.5,
  },
  {
    id: MARKSMAN,
    lanes: ["gold"],
    tags: levels({ scaling: 3, push: 2 }),
    wr: 0.5,
  },
  {
    id: ASSASSIN,
    lanes: ["jungle"],
    tags: levels({ burst: 3, mobility: 3, pickoff: 3 }),
    wr: 0.5,
  },
  {
    id: FIGHTER,
    lanes: ["exp"],
    tags: levels({ frontline: 2, sustain: 2, push: 2 }),
    wr: 0.5,
  },
  {
    id: MAGE_2,
    lanes: ["mid"],
    tags: levels({ damage_type: "magic", aoe_damage: 2 }),
    wr: 0.5,
  },
  {
    id: TANK_2,
    lanes: ["roam"],
    tags: levels({ frontline: 2, hard_cc: 2 }),
    wr: 0.49,
  },
];

const index = buildHeroIndex({
  heroes,
  stats: heroes.map((h) => ({
    hero_id: h.id,
    win_rate: h.wr,
    pick_rate: 0.02,
    ban_rate: 0.05,
  })),
  matchups: [[TANK, ASSASSIN, 0.03]],
  synergies: [
    [TANK, MARKSMAN, 0.02],
    [MARKSMAN, TANK, 0.02],
  ],
  tags: heroes.map((h) => ({ hero_id: h.id, ...h.tags })),
  notes: [{ heroId: TANK, strong: [], weak: [], teammates: [MARKSMAN] }],
});
const all = heroes.map((h) => h.id);
const members = (ids: number[]) =>
  ids.map((id) => ({ id, lanes: heroes.find((h) => h.id === id)!.lanes }));

describe("scorePick", () => {
  it("adds meta, counters, synergy and the composition gain", () => {
    const pick = scorePick(index, TANK, [MARKSMAN], [ASSASSIN]);
    // (0.52 × 0.02 + 0.5 × 0.002) / 0.022 = 0.51818 → 1.818 × 0.3.
    expect(pick.parts.meta).toBeCloseTo(0.5455, 4);
    // Stats +3, lockdown 1 × 3/3 × 3/3, peel 0.8 × 2/3 × 3/3; burst cancels.
    expect(pick.parts.counters).toBeCloseTo(3 + 1 + 1.6 / 3, 6);
    // +2 points together, +1 for the official teammate note.
    expect(pick.parts.synergy).toBeCloseTo(3, 10);
    expect(pick.links).toEqual([
      { teammateId: MARKSMAN, delta: 0.02, note: true, points: 3 },
    ]);
    const before = evaluateComposition(members([MARKSMAN]), index.tags);
    const after = evaluateComposition(members([MARKSMAN, TANK]), index.tags);
    expect(pick.parts.composition).toBeCloseTo(
      (after.score - before.score) * 10,
      10,
    );
    expect(pick.fixes.map((f) => f.id)).toEqual([
      "frontline",
      "hard_cc",
      "peel",
    ]);
    expect(pick.laneFit).toBe(true);
    expect(pick.score).toBeCloseTo(
      pick.parts.meta +
        pick.parts.counters +
        pick.parts.synergy +
        pick.parts.composition,
      10,
    );
  });
});

describe("suggestPicks", () => {
  it("leaves out heroes without an open lane unless asked", () => {
    const fitting = suggestPicks(index, all, [MAGE], [], new Set());
    expect(fitting.map((s) => s.heroId)).not.toContain(MAGE_2);
    const any = suggestPicks(index, all, [MAGE], [], new Set(), {
      openLanesOnly: false,
    });
    expect(any.map((s) => s.heroId)).toContain(MAGE_2);
  });

  it("puts the biggest checklist gain first when asked", () => {
    const gains = suggestPicks(index, all, [MARKSMAN], [], new Set(), {
      rankBy: "composition",
    }).map((s) => Math.round(s.parts.composition * 100));
    expect(gains).toEqual([...gains].sort((a, b) => b - a));
  });

  it("never suggests a hero that is taken", () => {
    const picks = suggestPicks(index, all, [], [ASSASSIN], new Set([TANK]));
    expect(picks.map((s) => s.heroId)).not.toContain(TANK);
    expect(picks.map((s) => s.heroId)).not.toContain(ASSASSIN);
  });
});

describe("suggestBans", () => {
  it("ranks by tier score before any pick", () => {
    const bans = suggestBans(index, all, [], [], new Set());
    expect(bans[0]).toMatchObject({ kind: "meta", heroId: TANK });
    expect(bans.at(-1)).toMatchObject({ heroId: TANK_2 });
  });

  it("once there are picks, bans what the other team would want most", () => {
    const bans = suggestBans(index, all, [ASSASSIN], [MARKSMAN], new Set());
    const enemyView = suggestPicks(
      index,
      all,
      [MARKSMAN],
      [ASSASSIN],
      new Set(),
      {
        openLanesOnly: false,
      },
    );
    expect(bans.map((b) => b.heroId)).toEqual(enemyView.map((p) => p.heroId));
    expect(bans[0]).toMatchObject({ kind: "threat", heroId: TANK });
  });
});

describe("teamStrength", () => {
  it("is empty before the first pick", () => {
    expect(teamStrength(index, [])).toBeNull();
  });

  it("weighs composition, form and synergy", () => {
    const one = teamStrength(index, [TANK])!;
    // The tank has the best adjusted win rate of the seven: 6.5 of 7 below or equal.
    expect(one.form).toBeCloseTo(6.5 / 7, 10);
    expect(one.synergy).toBe(0.5);
    expect(one.total).toBe(
      Math.round(40 * one.composition + 30 * one.form + 30 * one.synergy),
    );
    // Two points together: 0.5 + 2 / 20.
    expect(teamStrength(index, [TANK, MARKSMAN])!.synergy).toBeCloseTo(0.6, 10);
  });
});

describe("suggestSwaps", () => {
  it("swaps the second mid laner for a roaming tank first", () => {
    const team = [MAGE, MARKSMAN, ASSASSIN, FIGHTER, MAGE_2];
    const swaps = suggestSwaps(index, team, all);
    expect(swaps[0]).toMatchObject({ out: MAGE_2, in: TANK });
    expect(swaps[0]!.fixes.map((f) => f.id)).toContain("lanes");
    expect(swaps[0]!.gain).toBeGreaterThan(0);
    // One swap per hero taken out.
    expect(new Set(swaps.map((s) => s.out)).size).toBe(swaps.length);
  });
});
