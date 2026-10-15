import {
  COMPOSITION_RULES,
  type CompositionRulesConfig,
} from "@/config/composition-rules";
import type { HeroTagValues } from "@/types/data";
import { HERO_LANES, type HeroLane } from "@/types/domain";

export const TEAM_SIZE = 5;

export type CheckStatus = "ok" | "weak" | "missing";

export type CheckResult = {
  id: string;
  label: string;
  status: CheckStatus;
  weight: number;
} & (
  | { kind: "tag"; total: number; ok: number; weak: number }
  | { kind: "lanes"; covered: number; needed: number; open: HeroLane[] }
  | { kind: "damage"; physical: number; magic: number }
);

export type CompositionReport = {
  checks: CheckResult[];
  /** Weighted share of checks passed, 0 to 1 ("weak" counts half). */
  score: number;
  /** The team has five heroes. */
  complete: boolean;
  /** Heroes without curated tags; every tag check counts them as zero. */
  untagged: number[];
};

export type TeamMember = { id: number; lanes: readonly HeroLane[] };

/**
 * The most heroes that can each take a different lane, and the lanes left
 * open. Tries every assignment with augmenting paths; five by five is tiny.
 */
export function coverLanes(team: readonly TeamMember[]): {
  covered: number;
  open: HeroLane[];
} {
  const laneOwner = new Map<HeroLane, number>();
  const assign = (member: number, seen: Set<HeroLane>): boolean => {
    for (const lane of team[member]!.lanes) {
      if (seen.has(lane)) continue;
      seen.add(lane);
      const owner = laneOwner.get(lane);
      if (owner === undefined || assign(owner, seen)) {
        laneOwner.set(lane, member);
        return true;
      }
    }
    return false;
  };
  let covered = 0;
  team.forEach((_, i) => {
    if (assign(i, new Set())) covered++;
  });
  return {
    covered,
    open: HERO_LANES.filter((lane) => !laneOwner.has(lane)),
  };
}

function statusFor(total: number, ok: number, weak: number): CheckStatus {
  return total >= ok ? "ok" : total >= weak ? "weak" : "missing";
}

/**
 * The checklist from src/config/composition-rules.ts for up to five heroes.
 * A team with fewer heroes is checked as it stands.
 */
export function evaluateComposition(
  team: readonly TeamMember[],
  tags: ReadonlyMap<number, HeroTagValues>,
  config: CompositionRulesConfig = COMPOSITION_RULES,
): CompositionReport {
  const teamTags = team.flatMap((m) => {
    const t = tags.get(m.id);
    return t ? [t] : [];
  });

  const checks = config.checks.map((check): CheckResult => {
    const base = { id: check.id, label: check.label, weight: check.weight };
    switch (check.kind) {
      case "tag": {
        const total = teamTags.reduce((sum, t) => sum + t[check.tag], 0);
        return {
          ...base,
          kind: "tag",
          status: statusFor(total, check.ok, check.weak),
          total,
          ok: check.ok,
          weak: check.weak,
        };
      }
      case "lanes": {
        const needed = Math.min(team.length, TEAM_SIZE);
        const { covered, open } = coverLanes(team);
        return {
          ...base,
          kind: "lanes",
          status: statusFor(covered, needed, needed - 1),
          covered,
          needed,
          open,
        };
      }
      case "damage": {
        let physical = 0;
        let magic = 0;
        for (const t of teamTags) {
          if (t.damage_type === "physical") physical += 1;
          else if (t.damage_type === "magic") magic += 1;
          else {
            physical += 0.5;
            magic += 0.5;
          }
        }
        // Missing when one damage type is absent, weak when one hero
        // carries it alone.
        return {
          ...base,
          kind: "damage",
          status: statusFor(Math.min(physical, magic), 1.5, 0.5),
          physical,
          magic,
        };
      }
    }
  });

  const value = { ok: 1, weak: config.weakValue, missing: 0 };
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const score =
    totalWeight > 0
      ? checks.reduce((sum, c) => sum + c.weight * value[c.status], 0) /
        totalWeight
      : 0;
  return {
    checks,
    score,
    complete: team.length >= TEAM_SIZE,
    untagged: team.filter((m) => !tags.has(m.id)).map((m) => m.id),
  };
}
