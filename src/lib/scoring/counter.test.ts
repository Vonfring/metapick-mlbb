import { describe, expect, it } from "vitest";
import type { HeroTagValues } from "@/types/data";
import { pairEdge, rankCounters } from "./counter";
import {
  buildHeroIndex,
  type HeroIndexInput,
  type HeroNoteLists,
  type PairTuple,
} from "./hero-index";

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

const FANNY = 1;
const FRANCO = 2;
const MAGE = 3;

const tags = [
  { hero_id: FANNY, ...levels({ burst: 3, mobility: 3 }) },
  {
    hero_id: FRANCO,
    ...levels({ hard_cc: 3, frontline: 2, peel: 1, burst: 1 }),
  },
  {
    hero_id: MAGE,
    ...levels({ damage_type: "magic", burst: 2, mobility: 1, hard_cc: 1 }),
  },
];

const pair = (heroId: number, otherId: number, delta: number): PairTuple => [
  heroId,
  otherId,
  delta,
];

const note = (
  heroId: number,
  lists: Partial<Omit<HeroNoteLists, "heroId">>,
): HeroNoteLists => ({ heroId, strong: [], weak: [], teammates: [], ...lists });

function index(overrides: Partial<HeroIndexInput> = {}) {
  return buildHeroIndex({
    heroes: [
      { id: FANNY, lanes: ["jungle"] },
      { id: FRANCO, lanes: ["roam"] },
      { id: MAGE, lanes: ["mid"] },
    ],
    stats: [
      { hero_id: FANNY, win_rate: 0.5, pick_rate: 0.02, ban_rate: 0.3 },
      { hero_id: FRANCO, win_rate: 0.52, pick_rate: 0.02, ban_rate: 0.1 },
      { hero_id: MAGE, win_rate: 0.55, pick_rate: 0.02, ban_rate: 0.1 },
    ],
    matchups: [],
    synergies: [],
    tags,
    notes: [],
    ...overrides,
  });
}

describe("pairEdge", () => {
  it("adds the tag rules both ways when there is no other data", () => {
    const edge = pairEdge(index(), FRANCO, FANNY);
    // Lockdown: 1 × 3/3 × 3/3 = 1. Burst: 0.8 × 1/3 × 3/3 = 0.267 for Franco
    // and 0.8 × 3/3 × 1/3 = 0.267 for Fanny, which cancel. Peel: 0.8 × 1/3 × 3/3.
    expect(edge.points.tags).toBeCloseTo(1 + 0.8 / 3, 6);
    expect(edge.points.total).toBeCloseTo(1.2667, 4);
    expect(edge.hasData).toBe(false);
    // Only effects of at least 0.3 points are listed.
    expect(edge.tagReasons).toEqual([
      expect.objectContaining({ rule: "lockdown", by: "hero", points: 1 }),
    ]);
  });

  it("takes the statistics from either hero's list, with the sign flipped", () => {
    const fromFanny = pairEdge(
      index({ matchups: [pair(FANNY, FRANCO, -0.04)] }),
      FRANCO,
      FANNY,
    );
    expect(fromFanny.statsDelta).toBeCloseTo(0.04, 10);
    expect(fromFanny.statsFrom).toBe("opponent");
    expect(fromFanny.points.stats).toBeCloseTo(4, 10);
    expect(fromFanny.hasData).toBe(true);

    const fromFranco = pairEdge(
      index({ matchups: [pair(FRANCO, FANNY, 0.03)] }),
      FRANCO,
      FANNY,
    );
    expect(fromFranco.statsFrom).toBe("hero");
    expect(fromFranco.points.stats).toBeCloseTo(3, 10);
  });

  it("counts official notes from both heroes' pages", () => {
    const edge = pairEdge(
      index({
        notes: [
          note(FRANCO, { strong: [FANNY] }),
          note(FANNY, { weak: [FRANCO] }),
        ],
      }),
      FRANCO,
      FANNY,
    );
    expect(edge.points.notes).toBe(3);
    expect(edge.notes.map((n) => n.by)).toEqual(["hero", "opponent"]);

    const reverse = pairEdge(
      index({
        notes: [note(FRANCO, { strong: [FANNY] })],
      }),
      FANNY,
      FRANCO,
    );
    expect(reverse.points.notes).toBe(-1.5);
  });

  it("is antisymmetric: A against B is minus B against A", () => {
    const idx = index({
      matchups: [pair(FANNY, FRANCO, -0.04)],
      notes: [note(FRANCO, { strong: [FANNY] })],
    });
    const ab = pairEdge(idx, FRANCO, FANNY).points.total;
    const ba = pairEdge(idx, FANNY, FRANCO).points.total;
    expect(ab).toBeCloseTo(4 + 1.5 + 1 + 0.8 / 3, 6);
    expect(ba).toBeCloseTo(-ab, 10);
  });
});

describe("rankCounters", () => {
  it("ranks the hero with data against the enemy above a stronger meta hero", () => {
    const idx = index({
      matchups: [pair(FANNY, FRANCO, -0.04)],
      notes: [note(FRANCO, { strong: [FANNY] })],
    });
    const picks = rankCounters(idx, [FANNY], [FANNY, FRANCO, MAGE]);
    // Enemies are never suggested.
    expect(picks.map((p) => p.heroId)).toEqual([FRANCO, MAGE]);

    // Franco: 4 + 1.5 + 1.267 against Fanny, plus meta:
    // adjusted (0.52 × 0.02 + 0.5 × 0.002) / 0.022 = 0.51818 → 1.818 × 0.3.
    const [franco, mage] = picks;
    expect(franco!.metaPoints).toBeCloseTo(0.5455, 4);
    expect(franco!.score).toBeCloseTo(6.7667 + 0.5455, 3);
    expect(franco!.limitedData).toBe(false);

    // Mage: tags only. Lockdown 1 × 1/3 × 3/3 = 0.333; burst
    // 0.8 × 2/3 × 3/3 − 0.8 × 3/3 × 3/3 = −0.267. Meta (0.54545 − 0.5) × 100 × 0.3.
    expect(mage!.score).toBeCloseTo(0.0667 + 1.3636, 3);
    expect(mage!.limitedData).toBe(true);
  });

  it("adds up the edges against every enemy", () => {
    const idx = index({
      matchups: [pair(FRANCO, FANNY, 0.02), pair(FRANCO, MAGE, -0.01)],
    });
    const [pick] = rankCounters(idx, [FANNY, MAGE], [FRANCO]);
    expect(pick!.edges.map((e) => e.opponentId)).toEqual([FANNY, MAGE]);
    const edgeSum = pick!.edges.reduce((s, e) => s + e.points.total, 0);
    expect(pick!.score).toBeCloseTo(edgeSum + pick!.metaPoints, 10);
  });
});
