/**
 * How Draft master and Team composition suggest heroes and score a team
 * (docs/activity-draft-master.md). Points are the same as in Counter pick and
 * Matchup: one point is about one percentage point of win rate.
 *
 * Pick score of a candidate for a team:
 *   meta         (adjusted win rate − 50%) × 100 × metaWeight
 *   counters     Σ edge against every enemy pick × countersWeight
 *   synergy      Σ win rate change with every teammate × 100 × synergyWeight,
 *                plus teammateNotePoints per official "best teammate" note
 *   composition  rise in the team's checklist score × compositionPoints
 *
 * A ban before any pick ranks heroes by tier score (win, pick and ban rate,
 * see tier-scoring.ts). Once there are picks, a ban suggestion is the hero's
 * pick score for the other team.
 *
 * Strength of a team, 0 to 100:
 *   strength.composition × checklist score (0 to 1)
 * + strength.form × average percentile of the picks' adjusted win rate
 * + strength.synergy × (0.5 + Σ synergy points ÷ strength.synergyScale, kept 0 to 1)
 */
export const DRAFT_SCORING = {
  metaWeight: 0.3,
  countersWeight: 1,
  synergyWeight: 1,
  teammateNotePoints: 1,
  compositionPoints: 10,
  /** Suggestions shown for a turn. */
  suggestions: 8,
  /** Swaps suggested for a full team. */
  swaps: 3,
  /** Smallest composition gain, in points, worth suggesting a swap for. */
  minSwapGain: 1,
  strength: { composition: 40, form: 30, synergy: 30, synergyScale: 20 },
};

export type DraftScoringConfig = typeof DRAFT_SCORING;
