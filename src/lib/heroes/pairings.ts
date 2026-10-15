import type { PairRow } from "@/types/data";

export type Pairing = { heroId: number; delta: number };

function pairingsOf(heroId: number, rows: readonly PairRow[]) {
  return rows.filter((r) => r.hero_id === heroId && r.other_id !== heroId);
}

/**
 * Matchup and synergy rows come from each hero's own list in the official
 * data: its five best and five worst pairings. `delta` is the change in this
 * hero's win rate against (or with) the other hero; positive favors this hero.
 */
export function strongAgainst(
  heroId: number,
  matchups: readonly PairRow[],
  limit = 5,
): Pairing[] {
  return pairingsOf(heroId, matchups)
    .filter((r) => r.win_rate_delta > 0)
    .sort((a, b) => b.win_rate_delta - a.win_rate_delta)
    .slice(0, limit)
    .map((r) => ({ heroId: r.other_id, delta: r.win_rate_delta }));
}

/** Opponents this hero does worst against, the strongest counter first. */
export function counteredBy(
  heroId: number,
  matchups: readonly PairRow[],
  limit = 5,
): Pairing[] {
  return pairingsOf(heroId, matchups)
    .filter((r) => r.win_rate_delta < 0)
    .sort((a, b) => a.win_rate_delta - b.win_rate_delta)
    .slice(0, limit)
    .map((r) => ({ heroId: r.other_id, delta: r.win_rate_delta }));
}

/** Teammates that raise this hero's win rate the most. */
export function bestTeammates(
  heroId: number,
  synergies: readonly PairRow[],
  limit = 5,
): Pairing[] {
  return strongAgainst(heroId, synergies, limit);
}
