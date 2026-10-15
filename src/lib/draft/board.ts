import {
  type DraftAction,
  type DraftPreset,
  type DraftTeam,
} from "@/config/draft-order";

/** One hero placed on the board: a ban or a pick by one team. */
export type DraftStep = {
  index: number;
  team: DraftTeam;
  action: DraftAction;
  /** Index of the preset phase the step belongs to. */
  phase: number;
  blind: boolean;
};

/** A skipped ban. Hero ids are positive, so 0 never clashes with one. */
export const SKIP = 0;

/** A hero id, SKIP, or null for a step not played yet. */
export type Slot = number | null;

/**
 * Every step of a preset in a fixed order: within a blind phase all blue
 * bans come before all red bans. The URL stores slots in this order, so a
 * shared draft reads the same whichever side the reader plays.
 */
export function expandSteps(preset: DraftPreset): DraftStep[] {
  const steps: DraftStep[] = [];
  const add = (
    team: DraftTeam,
    action: DraftAction,
    phase: number,
    blind: boolean,
  ) => steps.push({ index: steps.length, team, action, phase, blind });
  preset.phases.forEach((phase, p) => {
    if (phase.blind) {
      for (const team of ["blue", "red"] as const)
        for (let i = 0; i < phase.perTeam; i++) add(team, "ban", p, true);
    } else {
      for (const letter of phase.order)
        add(letter === "B" ? "blue" : "red", phase.action, p, false);
    }
  });
  return steps;
}

/**
 * The order the board asks for heroes: in a blind phase your team's bans
 * come first, then the enemy's; everything else follows the preset.
 */
export function entryOrder(
  steps: readonly DraftStep[],
  side: DraftTeam,
): number[] {
  const order: number[] = [];
  let i = 0;
  while (i < steps.length) {
    const phase = steps[i]!.phase;
    const inPhase = steps.filter((s) => s.phase === phase);
    if (inPhase[0]!.blind) {
      order.push(
        ...inPhase.filter((s) => s.team === side).map((s) => s.index),
        ...inPhase.filter((s) => s.team !== side).map((s) => s.index),
      );
    } else {
      order.push(...inPhase.map((s) => s.index));
    }
    i += inPhase.length;
  }
  return order;
}

/**
 * Heroes that cannot go into step `at`: anything picked, anything banned in
 * another phase, and anything banned in the same phase by the same team. In a
 * turn-based phase the other team's bans count too; in a blind phase both
 * teams may ban the same hero, as in the game.
 */
export function unavailableAt(
  steps: readonly DraftStep[],
  slots: readonly Slot[],
  at: number,
): Set<number> {
  const step = steps[at]!;
  const taken = new Set<number>();
  slots.forEach((hero, k) => {
    if (k === at || hero === null || hero === SKIP) return;
    const other = steps[k]!;
    if (
      other.action === "pick" ||
      other.phase !== step.phase ||
      other.team === step.team ||
      !step.blind
    )
      taken.add(hero);
  });
  return taken;
}

/**
 * Slots from the URL's comma-separated list: hero slugs, "-" for a skipped
 * ban, "_" for a step not played. Phases are read in order; a blind phase
 * may be partly filled (each team's bans up to its first gap), any other
 * phase only from its start. Anything after the first gap, unknown hero or
 * illegal hero is dropped, so a broken link still opens a valid board.
 */
export function parseSlots(
  value: string | null,
  steps: readonly DraftStep[],
  idOf: (slug: string) => number | undefined,
): Slot[] {
  const tokens = value ? value.split(",") : [];
  const slots: Slot[] = steps.map(() => null);
  const phases = [...new Set(steps.map((s) => s.phase))];
  for (const phase of phases) {
    const inPhase = steps.filter((s) => s.phase === phase);
    const groups = inPhase[0]!.blind
      ? (["blue", "red"] as const).map((team) =>
          inPhase.filter((s) => s.team === team),
        )
      : [inPhase];
    let complete = true;
    for (const group of groups) {
      for (const step of group) {
        const token = tokens[step.index]?.trim();
        const hero =
          token === "-" && step.action === "ban"
            ? SKIP
            : token && token !== "_"
              ? idOf(token)
              : undefined;
        if (
          hero === undefined ||
          (hero !== SKIP && unavailableAt(steps, slots, step.index).has(hero))
        ) {
          complete = false;
          break;
        }
        slots[step.index] = hero;
      }
    }
    if (!complete) break;
  }
  return slots;
}

/** The URL value for a board, or null when it is empty. */
export function serializeSlots(
  slots: readonly Slot[],
  slugOf: (heroId: number) => string,
): string | null {
  const tokens = slots.map((hero) =>
    hero === null ? "_" : hero === SKIP ? "-" : slugOf(hero),
  );
  while (tokens.at(-1) === "_") tokens.pop();
  return tokens.length > 0 ? tokens.join(",") : null;
}

/** The step to play now, or null when the draft is complete. */
export function currentStep(
  steps: readonly DraftStep[],
  slots: readonly Slot[],
  side: DraftTeam,
): DraftStep | null {
  const next = entryOrder(steps, side).find((i) => slots[i] === null);
  return next === undefined ? null : steps[next]!;
}

/** The slots with the last hero placed taken back. */
export function undoSlots(
  steps: readonly DraftStep[],
  slots: readonly Slot[],
  side: DraftTeam,
): Slot[] {
  // The step just before the current one is the one played last. When the
  // current step comes first in the order (sides were swapped in the middle
  // of a blind phase), or the draft is complete, take the last filled step.
  const order = entryOrder(steps, side);
  const at = order.findIndex((i) => slots[i] === null);
  const last =
    at > 0 ? order[at - 1] : order.findLast((i) => slots[i] !== null);
  if (last === undefined) return [...slots];
  return slots.map((hero, i) => (i === last ? null : hero));
}

/** Where the current step sits in its run of same-team, same-action steps: "pick 2 of 2". */
export function turnPosition(
  steps: readonly DraftStep[],
  side: DraftTeam,
  current: DraftStep,
): { number: number; of: number } {
  const order = entryOrder(steps, side).map((i) => steps[i]!);
  const at = order.indexOf(current);
  const same = (s: DraftStep) =>
    s.team === current.team &&
    s.action === current.action &&
    s.phase === current.phase;
  let start = at;
  while (start > 0 && same(order[start - 1]!)) start--;
  let end = at;
  while (end < order.length - 1 && same(order[end + 1]!)) end++;
  return { number: at - start + 1, of: end - start + 1 };
}

/** One team's bans or picks, in step order, including unplayed ones. */
export function teamSlots(
  steps: readonly DraftStep[],
  slots: readonly Slot[],
  team: DraftTeam,
  action: DraftAction,
): Slot[] {
  return steps
    .filter((s) => s.team === team && s.action === action)
    .map((s) => slots[s.index]!);
}

/** One team's picks so far, as hero ids. */
export function picksOf(
  steps: readonly DraftStep[],
  slots: readonly Slot[],
  team: DraftTeam,
): number[] {
  return teamSlots(steps, slots, team, "pick").filter(
    (hero): hero is number => hero !== null && hero !== SKIP,
  );
}
