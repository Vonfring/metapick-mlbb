import { COMPOSITION_RULES } from "@/config/composition-rules";
import { COUNTER_SCORING } from "@/config/counter-scoring";
import { DRAFT_SCORING } from "@/config/draft-scoring";
import {
  type CheckStatus,
  type CompositionReport,
  evaluateComposition,
  TEAM_SIZE,
  type TeamMember,
} from "./composition";
import { metaPoints, pairEdge, type PairEdge } from "./counter";
import type { HeroIndex } from "./hero-index";

const configs = {
  draft: DRAFT_SCORING,
  counter: COUNTER_SCORING,
  composition: COMPOSITION_RULES,
};
export type DraftConfigs = typeof configs;

const members = (index: HeroIndex, team: readonly number[]): TeamMember[] =>
  team.map((id) => ({ id, lanes: index.lanes.get(id) ?? [] }));

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

const statusRank: Record<CheckStatus, number> = { missing: 0, weak: 1, ok: 2 };

/** Heroes with a lane of their own, from a report's lanes check. */
const lanesCovered = (report: CompositionReport) => {
  const check = report.checks.find((c) => c.kind === "lanes");
  return check?.kind === "lanes" ? check.covered : 0;
};

export type CheckChange = {
  id: string;
  label: string;
  from: CheckStatus;
  to: CheckStatus;
};

/** Checks whose status got better from one report to the next. */
export function improvedChecks(
  before: CompositionReport,
  after: CompositionReport,
): CheckChange[] {
  return after.checks.flatMap((check) => {
    const old = before.checks.find((c) => c.id === check.id);
    return old && statusRank[check.status] > statusRank[old.status]
      ? [
          {
            id: check.id,
            label: check.label,
            from: old.status,
            to: check.status,
          },
        ]
      : [];
  });
}

export type TeammateLink = {
  teammateId: number;
  /** Change in win rate together, or null without numbers. */
  delta: number | null;
  /** An official "best teammate" note links the two. */
  note: boolean;
  points: number;
};

export type PickSuggestion = {
  heroId: number;
  score: number;
  parts: {
    meta: number;
    counters: number;
    synergy: number;
    composition: number;
  };
  /** Edge against each enemy pick. */
  edges: PairEdge[];
  /** Teammates with numbers or an official note. */
  links: TeammateLink[];
  /** Checks the hero turns from missing or weak to better. */
  fixes: CheckChange[];
  /** The hero can take a lane the team still has open. */
  laneFit: boolean;
};

/** How well a hero would fit `team` against `enemies` (see src/config/draft-scoring.ts). */
export function scorePick(
  index: HeroIndex,
  heroId: number,
  team: readonly number[],
  enemies: readonly number[],
  config: DraftConfigs = configs,
  before: CompositionReport = evaluateComposition(
    members(index, team),
    index.tags,
    config.composition,
  ),
): PickSuggestion {
  const w = config.draft;
  const edges = enemies.map((e) => pairEdge(index, heroId, e, config.counter));
  const links = team.flatMap((teammateId): TeammateLink[] => {
    const delta =
      index.synergies.get(heroId)?.get(teammateId) ??
      index.synergies.get(teammateId)?.get(heroId) ??
      null;
    const note = Boolean(
      index.notes.get(heroId)?.teammates.has(teammateId) ||
      index.notes.get(teammateId)?.teammates.has(heroId),
    );
    if (delta === null && !note) return [];
    const points =
      (delta ?? 0) * 100 * w.synergyWeight + (note ? w.teammateNotePoints : 0);
    return [{ teammateId, delta, note, points }];
  });
  const withHero = [...team, heroId];
  const after = evaluateComposition(
    members(index, withHero),
    index.tags,
    config.composition,
  );
  const parts = {
    meta: metaPoints(index, heroId, w.metaWeight),
    counters: sum(edges.map((e) => e.points.total)) * w.countersWeight,
    synergy: sum(links.map((l) => l.points)),
    composition: (after.score - before.score) * w.compositionPoints,
  };
  return {
    heroId,
    score: parts.meta + parts.counters + parts.synergy + parts.composition,
    parts,
    edges,
    links,
    fixes: improvedChecks(before, after),
    laneFit: lanesCovered(after) > lanesCovered(before),
  };
}

/**
 * The best heroes for a team's next pick, best first. With `openLanesOnly`
 * heroes that cannot take an open lane are left out, unless none can. With
 * `rankBy: "composition"` (Team composition) the checklist gain comes first
 * and the full score breaks ties; Draft master ranks by the full score.
 */
export function suggestPicks(
  index: HeroIndex,
  candidates: Iterable<number>,
  team: readonly number[],
  enemies: readonly number[],
  unavailable: ReadonlySet<number>,
  {
    openLanesOnly = true,
    rankBy = "score",
    limit = DRAFT_SCORING.suggestions,
  }: {
    openLanesOnly?: boolean;
    rankBy?: "score" | "composition";
    limit?: number;
  } = {},
  config: DraftConfigs = configs,
): PickSuggestion[] {
  const before = evaluateComposition(
    members(index, team),
    index.tags,
    config.composition,
  );
  const scored: PickSuggestion[] = [];
  for (const heroId of candidates) {
    if (
      unavailable.has(heroId) ||
      team.includes(heroId) ||
      enemies.includes(heroId)
    )
      continue;
    scored.push(scorePick(index, heroId, team, enemies, config, before));
  }
  const fitting = scored.filter((s) => s.laneFit);
  const pool =
    openLanesOnly && team.length < TEAM_SIZE && fitting.length > 0
      ? fitting
      : scored;
  // Composition gains are compared to a hundredth of a point, so float noise
  // does not decide the order.
  const gain = (s: PickSuggestion) => Math.round(s.parts.composition * 100);
  return pool
    .sort(
      (a, b) =>
        (rankBy === "composition" ? gain(b) - gain(a) : 0) ||
        b.score - a.score ||
        b.parts.meta - a.parts.meta ||
        a.heroId - b.heroId,
    )
    .slice(0, limit);
}

export type BanSuggestion =
  /** Before any pick: strength in the tier list. */
  | { kind: "meta"; heroId: number; score: number }
  /** Once there are picks: what the hero would be worth to the other team. */
  | { kind: "threat"; heroId: number; score: number; pick: PickSuggestion };

/**
 * Heroes worth banning for a team, best first. `ownPicks` are the banning
 * team's picks, `enemyPicks` the other team's.
 */
export function suggestBans(
  index: HeroIndex,
  candidates: Iterable<number>,
  ownPicks: readonly number[],
  enemyPicks: readonly number[],
  unavailable: ReadonlySet<number>,
  { limit = DRAFT_SCORING.suggestions } = {},
  config: DraftConfigs = configs,
): BanSuggestion[] {
  if (ownPicks.length === 0 && enemyPicks.length === 0) {
    const ranked: BanSuggestion[] = [];
    for (const heroId of candidates) {
      const score = index.meta.get(heroId)?.tierScore;
      if (unavailable.has(heroId) || score === null || score === undefined)
        continue;
      ranked.push({ kind: "meta", heroId, score });
    }
    return ranked
      .sort((a, b) => b.score - a.score || a.heroId - b.heroId)
      .slice(0, limit);
  }
  return suggestPicks(
    index,
    candidates,
    enemyPicks,
    ownPicks,
    unavailable,
    { openLanesOnly: false, limit },
    config,
  ).map((pick) => ({
    kind: "threat",
    heroId: pick.heroId,
    score: pick.score,
    pick,
  }));
}

export type TeamStrength = {
  /** 0 to 100. */
  total: number;
  /** Each part 0 to 1, before its weight. */
  composition: number;
  form: number;
  synergy: number;
  report: CompositionReport;
};

/** Share of heroes with a lower adjusted win rate (ties count half), 0 to 1. */
function formPercentile(index: HeroIndex, heroId: number): number {
  const own = index.meta.get(heroId)?.adjustedWinRate;
  if (own === undefined || index.meta.size === 0) return 0.5;
  let below = 0;
  let equal = 0;
  for (const m of index.meta.values()) {
    if (m.adjustedWinRate < own) below++;
    else if (m.adjustedWinRate === own) equal++;
  }
  return (below + equal / 2) / index.meta.size;
}

/** A team's strength on its own, 0 to 100, or null before its first pick. */
export function teamStrength(
  index: HeroIndex,
  team: readonly number[],
  config: DraftConfigs = configs,
): TeamStrength | null {
  if (team.length === 0) return null;
  const s = config.draft.strength;
  const report = evaluateComposition(
    members(index, team),
    index.tags,
    config.composition,
  );
  const form = sum(team.map((id) => formPercentile(index, id))) / team.length;
  let synergyPoints = 0;
  team.forEach((a, i) => {
    for (const b of team.slice(i + 1)) {
      const delta =
        index.synergies.get(a)?.get(b) ?? index.synergies.get(b)?.get(a);
      if (delta !== undefined) synergyPoints += delta * 100;
    }
  });
  const synergy = Math.min(
    1,
    Math.max(0, 0.5 + synergyPoints / s.synergyScale),
  );
  return {
    total: Math.round(
      s.composition * report.score + s.form * form + s.synergy * synergy,
    ),
    composition: report.score,
    form,
    synergy,
    report,
  };
}

export type Swap = {
  out: number;
  in: number;
  /** Rise in the composition score, in points (score change × compositionPoints). */
  gain: number;
  fixes: CheckChange[];
};

/**
 * For a full team: the best replacement for each hero, then the swaps that
 * raise the composition score most, one per hero taken out.
 */
export function suggestSwaps(
  index: HeroIndex,
  team: readonly number[],
  candidates: Iterable<number>,
  { limit = DRAFT_SCORING.swaps } = {},
  config: DraftConfigs = configs,
): Swap[] {
  const before = evaluateComposition(
    members(index, team),
    index.tags,
    config.composition,
  );
  const pool = [...candidates].filter((id) => !team.includes(id));
  const best: Swap[] = [];
  for (const out of team) {
    let top: (Swap & { meta: number }) | null = null;
    for (const candidate of pool) {
      const next = team.map((id) => (id === out ? candidate : id));
      const after = evaluateComposition(
        members(index, next),
        index.tags,
        config.composition,
      );
      const gain =
        (after.score - before.score) * config.draft.compositionPoints;
      if (gain < config.draft.minSwapGain) continue;
      const meta = metaPoints(index, candidate, 1);
      if (!top || gain > top.gain || (gain === top.gain && meta > top.meta))
        top = {
          out,
          in: candidate,
          gain,
          fixes: improvedChecks(before, after),
          meta,
        };
    }
    if (top)
      best.push({ out: top.out, in: top.in, gain: top.gain, fixes: top.fixes });
  }
  return best.sort((a, b) => b.gain - a.gain || a.out - b.out).slice(0, limit);
}
