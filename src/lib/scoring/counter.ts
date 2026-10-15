import {
  COUNTER_SCORING,
  type CounterScoringConfig,
  type TagRule,
} from "@/config/counter-scoring";
import type { HeroTagValues } from "@/types/data";
import type { HeroIndex } from "./hero-index";

/** Who an official note or a tag reason belongs to. */
export type Side = "hero" | "opponent";

export type NoteReason = {
  kind: "strong_against" | "weak_against";
  /** Whose official page has the note. */
  by: Side;
  /** Points from the hero's point of view. */
  points: number;
};

export type TagReason = {
  rule: string;
  label: string;
  /** The hero whose strength the rule describes. */
  by: Side;
  /** Points from the hero's point of view: negative when the opponent's strength. */
  points: number;
};

/** How much a hero counters one opponent (see src/config/counter-scoring.ts). */
export type PairEdge = {
  heroId: number;
  opponentId: number;
  /** Change in the hero's win rate against the opponent, or null without data. */
  statsDelta: number | null;
  /** Whose list of best and worst matchups the number comes from. */
  statsFrom: Side | null;
  notes: NoteReason[];
  /** Tag effects large enough to list. Smaller ones still count in the points. */
  tagReasons: TagReason[];
  points: { stats: number; notes: number; tags: number; total: number };
  /** Statistics or an official note back this edge, not only tags. */
  hasData: boolean;
};

function rulePoints(
  rule: TagRule,
  attacker: HeroTagValues,
  target: HeroTagValues,
) {
  const lowest = Math.min(...rule.target.map((key) => target[key]));
  const targetLevel = rule.invertTarget ? 3 - lowest : lowest;
  return rule.points * (attacker[rule.attacker] / 3) * (targetLevel / 3);
}

export function pairEdge(
  index: HeroIndex,
  heroId: number,
  opponentId: number,
  config: CounterScoringConfig = COUNTER_SCORING,
): PairEdge {
  // A pair appears in one hero's list or in both; both say the same thing
  // with opposite signs.
  const own = index.matchups.get(heroId)?.get(opponentId);
  const theirs = index.matchups.get(opponentId)?.get(heroId);
  const statsDelta = own ?? (theirs === undefined ? null : -theirs);
  const statsFrom: Side | null =
    own !== undefined ? "hero" : theirs !== undefined ? "opponent" : null;

  const notes: NoteReason[] = [];
  const mine = index.notes.get(heroId);
  const other = index.notes.get(opponentId);
  const rp = config.relationPoints;
  if (mine?.strong.has(opponentId))
    notes.push({ kind: "strong_against", by: "hero", points: rp });
  if (other?.weak.has(heroId))
    notes.push({ kind: "weak_against", by: "opponent", points: rp });
  if (mine?.weak.has(opponentId))
    notes.push({ kind: "weak_against", by: "hero", points: -rp });
  if (other?.strong.has(heroId))
    notes.push({ kind: "strong_against", by: "opponent", points: -rp });

  const tagReasons: TagReason[] = [];
  let tagPoints = 0;
  const heroTags = index.tags.get(heroId);
  const opponentTags = index.tags.get(opponentId);
  if (heroTags && opponentTags) {
    for (const rule of config.tagRules) {
      const forward = rulePoints(rule, heroTags, opponentTags);
      const backward = rulePoints(rule, opponentTags, heroTags);
      tagPoints += forward - backward;
      if (forward >= config.minReasonPoints)
        tagReasons.push({
          rule: rule.id,
          label: rule.label,
          by: "hero",
          points: forward,
        });
      if (backward >= config.minReasonPoints)
        tagReasons.push({
          rule: rule.id,
          label: rule.label,
          by: "opponent",
          points: -backward,
        });
    }
  }

  const stats = statsDelta === null ? 0 : statsDelta * 100 * config.statsWeight;
  const notePoints = notes.reduce((sum, n) => sum + n.points, 0);
  return {
    heroId,
    opponentId,
    statsDelta,
    statsFrom,
    notes,
    tagReasons,
    points: {
      stats,
      notes: notePoints,
      tags: tagPoints,
      total: stats + notePoints + tagPoints,
    },
    hasData: statsDelta !== null || notes.length > 0,
  };
}

/** (adjusted win rate − 50%) × 100 × weight; 0 when the hero has no statistics. */
export function metaPoints(
  index: HeroIndex,
  heroId: number,
  weight: number,
): number {
  const meta = index.meta.get(heroId);
  return meta ? (meta.adjustedWinRate - 0.5) * 100 * weight : 0;
}

export type CounterPick = {
  heroId: number;
  score: number;
  /** One edge per enemy, in the order the enemies were picked. */
  edges: PairEdge[];
  metaPoints: number;
  /** No statistics or official note against any enemy: tags and meta only. */
  limitedData: boolean;
};

/** Candidates ranked by how well they counter the enemies, best first. */
export function rankCounters(
  index: HeroIndex,
  enemies: readonly number[],
  candidates: Iterable<number>,
  config: CounterScoringConfig = COUNTER_SCORING,
): CounterPick[] {
  const enemySet = new Set(enemies);
  const picks: CounterPick[] = [];
  for (const heroId of candidates) {
    if (enemySet.has(heroId)) continue;
    const edges = enemies.map((enemy) =>
      pairEdge(index, heroId, enemy, config),
    );
    const meta = metaPoints(index, heroId, config.metaWeight);
    picks.push({
      heroId,
      score: edges.reduce((sum, e) => sum + e.points.total, 0) + meta,
      edges,
      metaPoints: meta,
      limitedData: !edges.some((e) => e.hasData),
    });
  }
  return picks.sort(
    (a, b) =>
      b.score - a.score || b.metaPoints - a.metaPoints || a.heroId - b.heroId,
  );
}
