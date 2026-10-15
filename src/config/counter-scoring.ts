import type { TagLevelKey } from "@/types/data";

/**
 * How much one hero counters another, and how Counter pick ranks heroes.
 * Everything is measured in points, where one point is roughly one
 * percentage point of win rate. Change a number and redeploy.
 *
 * Edge of hero A against hero B (positive favors A):
 *
 * 1. Statistics: the change in A's win rate in games against B, times
 *    `statsWeight`. The official data lists each hero's five best and five
 *    worst matchups, so a pair is found in A's list, in B's list (with the
 *    sign flipped), or not at all.
 * 2. Official notes: `relationPoints` for each official note that says A is
 *    strong against B or that B is weak against A; minus the same for the
 *    opposite notes.
 * 3. Tags: each rule below gives
 *      points × (A's level ÷ 3) × (B's level ÷ 3)
 *    using the curated tags in seed/hero-tags.json, and the same rules
 *    applied the other way round count against A.
 *
 * Counter pick score of a hero = the sum of its edges against every enemy
 * + (adjusted win rate − 50%) × 100 × `metaWeight`, where the adjusted win
 * rate is the one the tier list uses (pulled toward 50% for rarely picked
 * heroes, see tier-scoring.ts).
 */
export const COUNTER_SCORING = {
  /** Points per percentage point of win rate change in the statistics. */
  statsWeight: 1,
  /** Points per official note. */
  relationPoints: 1.5,
  tagRules: [
    {
      id: "lockdown",
      label: "Hard crowd control against a mobile hero",
      attacker: "hard_cc",
      target: ["mobility"],
      invertTarget: false,
      points: 1,
    },
    {
      id: "burst",
      label: "Burst against a hero with little frontline",
      attacker: "burst",
      target: ["frontline"],
      invertTarget: true,
      points: 0.8,
    },
    {
      id: "peel",
      label: "Peel against a diving assassin",
      attacker: "peel",
      // A diver needs both: the lower of the two levels counts.
      target: ["burst", "mobility"],
      invertTarget: false,
      points: 0.8,
    },
  ] satisfies readonly TagRule[],
  /** Tag effects smaller than this still count but are not listed as reasons. */
  minReasonPoints: 0.3,
  /** Points per percentage point of adjusted win rate above 50%. */
  metaWeight: 0.3,
};

export type TagRule = {
  id: string;
  label: string;
  attacker: TagLevelKey;
  /** Target tags; when several, the lowest level counts. */
  target: readonly TagLevelKey[];
  /** Use 3 − level, for rules that target a weakness. */
  invertTarget: boolean;
  /** Points when both levels are 3. */
  points: number;
};

export type CounterScoringConfig = typeof COUNTER_SCORING;
