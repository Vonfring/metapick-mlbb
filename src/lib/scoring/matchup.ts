import { COMPOSITION_RULES } from "@/config/composition-rules";
import { COUNTER_SCORING } from "@/config/counter-scoring";
import {
  MATCHUP_SCORING,
  type MatchupScoringConfig,
} from "@/config/matchup-scoring";
import {
  type CompositionReport,
  evaluateComposition,
  type TeamMember,
} from "./composition";
import { metaPoints, pairEdge, type PairEdge } from "./counter";
import type { HeroIndex } from "./hero-index";

const configs = {
  counter: COUNTER_SCORING,
  matchup: MATCHUP_SCORING,
  composition: COMPOSITION_RULES,
};
export type MatchupConfigs = typeof configs;

export type Verdict = {
  /** Points; positive favors the first side. */
  total: number;
  favored: "first" | "second" | null;
  strength: "even" | "slight" | "clear";
  /** Rule-based estimate for the first side, in percent. */
  estimate: number;
};

export function verdictFor(
  total: number,
  config: MatchupScoringConfig = MATCHUP_SCORING,
): Verdict {
  const size = Math.abs(total);
  const [low, high] = config.estimateRange;
  if (size < config.evenBelow)
    return { total, favored: null, strength: "even", estimate: 50 };
  return {
    total,
    favored: total > 0 ? "first" : "second",
    strength: size < config.clearFrom ? "slight" : "clear",
    estimate: Math.min(high, Math.max(low, Math.round(50 + total))),
  };
}

export type HeroMatchup = {
  edge: PairEdge;
  /** Adjusted win rate difference, in points (first hero minus second). */
  metaPoints: number;
  verdict: Verdict;
};

export function heroMatchup(
  index: HeroIndex,
  first: number,
  second: number,
  config: MatchupConfigs = configs,
): HeroMatchup {
  const edge = pairEdge(index, first, second, config.counter);
  const w = config.matchup.metaWeight;
  const meta = metaPoints(index, first, w) - metaPoints(index, second, w);
  return {
    edge,
    metaPoints: meta,
    verdict: verdictFor(edge.points.total + meta, config.matchup),
  };
}

export type SynergyPair = { heroId: number; teammateId: number; delta: number };

export type TeamMatchup = {
  meta: { blue: number; red: number; points: number };
  /** Every blue hero against every red hero, the largest edges first. */
  counters: { pairs: PairEdge[]; points: number };
  synergy: { blue: SynergyPair[]; red: SynergyPair[]; points: number };
  composition: {
    blue: CompositionReport;
    red: CompositionReport;
    /** Null until both teams have five heroes. */
    points: number | null;
  };
  verdict: Verdict;
};

/** Teammate pairs with a known win rate change together. */
export function teamSynergies(
  index: HeroIndex,
  team: readonly number[],
): SynergyPair[] {
  const pairs: SynergyPair[] = [];
  team.forEach((heroId, i) => {
    for (const teammateId of team.slice(i + 1)) {
      const delta =
        index.synergies.get(heroId)?.get(teammateId) ??
        index.synergies.get(teammateId)?.get(heroId);
      if (delta !== undefined) pairs.push({ heroId, teammateId, delta });
    }
  });
  return pairs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

/** Blue against red, positive totals favor blue. See src/config/matchup-scoring.ts. */
export function teamMatchup(
  index: HeroIndex,
  blue: readonly number[],
  red: readonly number[],
  config: MatchupConfigs = configs,
): TeamMatchup {
  const w = config.matchup;
  const metaOf = (team: readonly number[]) =>
    sum(team.map((id) => metaPoints(index, id, 1)));
  const meta = { blue: metaOf(blue), red: metaOf(red), points: 0 };
  meta.points = (meta.blue - meta.red) * w.metaWeight;

  const pairs = blue
    .flatMap((b) => red.map((r) => pairEdge(index, b, r, config.counter)))
    .sort((a, b) => Math.abs(b.points.total) - Math.abs(a.points.total));
  const counters = {
    pairs,
    points: sum(pairs.map((p) => p.points.total)) * w.countersWeight,
  };

  const blueSynergy = teamSynergies(index, blue);
  const redSynergy = teamSynergies(index, red);
  const synergyTotal = (pairs: SynergyPair[]) =>
    sum(pairs.map((p) => p.delta * 100));
  const synergy = {
    blue: blueSynergy,
    red: redSynergy,
    points:
      (synergyTotal(blueSynergy) - synergyTotal(redSynergy)) * w.synergyWeight,
  };

  const members = (team: readonly number[]): TeamMember[] =>
    team.map((id) => ({ id, lanes: index.lanes.get(id) ?? [] }));
  const blueReport = evaluateComposition(
    members(blue),
    index.tags,
    config.composition,
  );
  const redReport = evaluateComposition(
    members(red),
    index.tags,
    config.composition,
  );
  const composition = {
    blue: blueReport,
    red: redReport,
    points:
      blueReport.complete && redReport.complete
        ? (blueReport.score - redReport.score) * w.compositionPoints
        : null,
  };

  const total =
    meta.points + counters.points + synergy.points + (composition.points ?? 0);
  return {
    meta,
    counters,
    synergy,
    composition,
    verdict: verdictFor(total, w),
  };
}
