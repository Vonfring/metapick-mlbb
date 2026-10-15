import type { Tier } from "@/types/domain";

/**
 * The tier list formula. Tiers are computed when pages are built and never
 * stored, so changing a number here and redeploying is all it takes.
 *
 * 1. Win rate is pulled toward 50% for rarely picked heroes:
 *      adjusted = (winRate × pickRate + 0.5 × shrinkage) / (pickRate + shrinkage)
 * 2. score = weights.winRate × z(adjusted) + weights.pickRate × z(pickRate)
 *          + weights.banRate × z(banRate)
 *    where z() compares a hero with every hero in the same rank and period.
 * 3. Heroes are ranked by score and split into tiers by percentile.
 *
 * Pick rate is the hero's share of all picks (all heroes add up to 100%);
 * ban rate is the share of games in which the hero was banned.
 */
export const TIER_SCORING = {
  /** Pick share at which a hero's win rate counts for half (0.002 = 0.2%). */
  shrinkage: 0.002,
  weights: { winRate: 0.55, pickRate: 0.2, banRate: 0.25 },
  /** Lowest percentile (0 = worst, 100 = best) that reaches each tier, best first. */
  cutoffs: [
    ["SS", 95],
    ["S", 80],
    ["A", 55],
    ["B", 30],
    ["C", 10],
    ["D", 0],
  ] as const satisfies readonly (readonly [Tier, number])[],
  /** Heroes picked less than this share of the time are listed as rarely picked, without a tier. */
  minPickRate: 0.001,
};

export type TierScoringConfig = typeof TIER_SCORING;
