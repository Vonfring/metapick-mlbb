/**
 * How Matchup turns edges into a verdict. Edges between two heroes come from
 * counter-scoring.ts; the composition score from composition-rules.ts. All
 * values are points, where one point is roughly one percentage point of win
 * rate.
 *
 * Hero against hero:
 *   total = edge of A against B
 *         + (adjusted win rate of A − adjusted win rate of B) × 100 × metaWeight
 *
 * Team against team (positive favors the blue team):
 *   meta        = Σ blue (adjusted win rate − 50%) × 100 − the same for red,
 *                 times metaWeight
 *   counters    = Σ over every blue and red pair of the edge of the blue hero,
 *                 times countersWeight
 *   synergy     = Σ over every pair of blue teammates of their win rate
 *                 change together × 100 − the same for red, times synergyWeight
 *   composition = (blue score − red score) × compositionPoints, once both
 *                 teams have five heroes
 *
 * Estimate = 50% + total, kept between `estimateRange`. This is a rule-based
 * estimate, not a prediction model.
 */
export const MATCHUP_SCORING = {
  metaWeight: 0.3,
  countersWeight: 0.5,
  synergyWeight: 0.5,
  compositionPoints: 10,
  /** Lowest and highest estimate for the side in front, in percent. */
  estimateRange: [30, 70] as const,
  /** Totals closer to zero than this read as even. */
  evenBelow: 1,
  /** Totals from this size on read as clearly favored. */
  clearFrom: 4,
};

export type MatchupScoringConfig = typeof MATCHUP_SCORING;
