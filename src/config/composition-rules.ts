import type { TagLevelKey } from "@/types/data";

/**
 * The team composition checklist, used by Matchup (team against team) and,
 * later, Team composition and Draft master.
 *
 * A tag check adds up one curated tag (0 to 3 per hero) over the team:
 * "ok" from `ok`, "weak" from `weak`, otherwise "missing". The cut-offs sit
 * near the 25th and 10th percentile of random teams with one hero per lane,
 * so most sensible teams pass most checks.
 *
 * Composition score = the weighted share of checks passed, with "weak"
 * counting half: 0 (nothing) to 1 (everything).
 */
export const COMPOSITION_RULES = {
  checks: [
    {
      id: "lanes",
      kind: "lanes",
      label: "Every lane covered",
      hint: "Two or more heroes want the same lane, so one lane has no specialist.",
      weight: 2,
    },
    {
      id: "frontline",
      kind: "tag",
      label: "Frontline",
      hint: "No one can take hits at the front, so fights start badly.",
      tag: "frontline",
      ok: 3,
      weak: 2,
      weight: 2,
    },
    {
      id: "hard_cc",
      kind: "tag",
      label: "Hard crowd control",
      hint: "Too little crowd control to start a fight or stop a diving enemy.",
      tag: "hard_cc",
      ok: 5,
      weak: 3,
      weight: 2,
    },
    {
      id: "damage_mix",
      kind: "damage",
      label: "Physical and magic damage",
      hint: "Nearly all damage is one type, so the enemy can stack one kind of defense.",
      weight: 1.5,
    },
    {
      id: "peel",
      kind: "tag",
      label: "Peel for carries",
      hint: "Little protection for the damage dealers when enemies dive them.",
      tag: "peel",
      ok: 2,
      weak: 1,
      weight: 1,
    },
    {
      id: "aoe_damage",
      kind: "tag",
      label: "Area damage",
      hint: "Little damage that hits several enemies, so team fights drag on.",
      tag: "aoe_damage",
      ok: 5,
      weak: 3,
      weight: 1,
    },
    {
      id: "pickoff",
      kind: "tag",
      label: "Pick-off",
      hint: "Few ways to catch a lone enemy out of position.",
      tag: "pickoff",
      ok: 5,
      weak: 3,
      weight: 1,
    },
    {
      id: "push",
      kind: "tag",
      label: "Turret push",
      hint: "Slow at taking turrets once a fight is won.",
      tag: "push",
      ok: 3,
      weak: 2,
      weight: 1,
    },
    {
      id: "scaling",
      kind: "tag",
      label: "Late game",
      hint: "The team falls off late; aim to win the early game.",
      tag: "scaling",
      ok: 7,
      weak: 6,
      weight: 1,
    },
  ] satisfies readonly CompositionCheck[],
  /** Value of a "weak" check in the score; "ok" is 1 and "missing" is 0. */
  weakValue: 0.5,
};

export type CompositionCheck =
  | {
      id: string;
      kind: "lanes" | "damage";
      label: string;
      /** What a missing or weak check means, in plain words. */
      hint: string;
      weight: number;
    }
  | {
      id: string;
      kind: "tag";
      label: string;
      hint: string;
      tag: TagLevelKey;
      ok: number;
      weak: number;
      weight: number;
    };

export type CompositionRulesConfig = typeof COMPOSITION_RULES;
