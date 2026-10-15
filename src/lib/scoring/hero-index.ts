import { TIER_SCORING, type TierScoringConfig } from "@/config/tier-scoring";
import type { HeroStatRow, HeroTagValues } from "@/types/data";
import type { HeroLane, Tier } from "@/types/domain";
import { computeTiers } from "./tier";

/** A hero's rates in the chosen rank, and the win rate the tier list ranks by. */
export type HeroMeta = {
  winRate: number;
  pickRate: number;
  banRate: number;
  /** Win rate pulled toward 50% for rarely picked heroes (see tier-scoring.ts). */
  adjustedWinRate: number;
  tier: Tier | null;
};

export type HeroNotes = {
  strong: Set<number>;
  weak: Set<number>;
  teammates: Set<number>;
};

/** Lookups the counter and matchup scores read from. Built once per rank. */
export type HeroIndex = {
  lanes: Map<number, readonly HeroLane[]>;
  meta: Map<number, HeroMeta>;
  /** hero → other hero → change in the hero's win rate against the other. */
  matchups: Map<number, Map<number, number>>;
  /** hero → teammate → change in the hero's win rate with the teammate. */
  synergies: Map<number, Map<number, number>>;
  tags: Map<number, HeroTagValues>;
  /** Official notes: whom the hero is strong against, weak against, good with. */
  notes: Map<number, HeroNotes>;
};

/** A matchup or synergy: [hero, other hero, change in the hero's win rate]. */
export type PairTuple = readonly [number, number, number];

/** A hero's official notes, as hero ids. */
export type HeroNoteLists = {
  heroId: number;
  strong: readonly number[];
  weak: readonly number[];
  teammates: readonly number[];
};

/** Curated tag levels and damage type of one hero. */
export type HeroTagLevels = Omit<HeroTagValues, "needs_review" | "notes"> & {
  hero_id: number;
};

export type HeroIndexInput = {
  heroes: readonly { id: number; lanes: readonly HeroLane[] }[];
  stats: readonly HeroStatRow[];
  matchups: readonly PairTuple[];
  synergies: readonly PairTuple[];
  tags: readonly HeroTagLevels[];
  notes: readonly HeroNoteLists[];
};

function pairMap(rows: readonly PairTuple[]) {
  const map = new Map<number, Map<number, number>>();
  for (const [heroId, otherId, delta] of rows) {
    if (heroId === otherId) continue;
    let inner = map.get(heroId);
    if (!inner) map.set(heroId, (inner = new Map()));
    inner.set(otherId, delta);
  }
  return map;
}

export function buildHeroIndex(
  input: HeroIndexInput,
  tierConfig: TierScoringConfig = TIER_SCORING,
): HeroIndex {
  const tiers = computeTiers(input.stats, tierConfig);
  const meta = new Map<number, HeroMeta>();
  for (const s of input.stats) {
    const tier = tiers.get(s.hero_id);
    meta.set(s.hero_id, {
      winRate: s.win_rate,
      pickRate: s.pick_rate,
      banRate: s.ban_rate,
      adjustedWinRate: tier?.adjustedWinRate ?? s.win_rate,
      tier: tier?.tier ?? null,
    });
  }

  const others = (heroId: number, ids: readonly number[]) =>
    new Set(ids.filter((id) => id !== heroId));
  const notes = new Map<number, HeroNotes>(
    input.notes.map((n) => [
      n.heroId,
      {
        strong: others(n.heroId, n.strong),
        weak: others(n.heroId, n.weak),
        teammates: others(n.heroId, n.teammates),
      },
    ]),
  );

  return {
    lanes: new Map(input.heroes.map((h) => [h.id, h.lanes])),
    meta,
    matchups: pairMap(input.matchups),
    synergies: pairMap(input.synergies),
    tags: new Map(
      input.tags.map(({ hero_id, ...levels }) => [hero_id, levels]),
    ),
    notes,
  };
}
