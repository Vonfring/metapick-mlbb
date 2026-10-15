import type * as React from "react";
import type { Verdict } from "@/lib/scoring/matchup";
import { cn } from "@/lib/utils";

/** "Khufra is favored", from the side names and a verdict. */
export function verdictText(verdict: Verdict, first: string, second: string) {
  if (!verdict.favored) return "Even matchup";
  const name = verdict.favored === "first" ? first : second;
  return verdict.strength === "clear"
    ? `${name} is favored`
    : `Slight edge to ${name}`;
}

/**
 * The matchup verdict on the board's diagonal: the blue side in the lower
 * left, the red side in the upper right, as on the game map.
 */
export function VerdictBanner({
  verdict,
  firstName,
  secondName,
  first,
  second,
}: {
  verdict: Verdict;
  firstName: string;
  secondName: string;
  /** Portrait or team summary for each side. */
  first: React.ReactNode;
  second: React.ReactNode;
}) {
  const firstShare = verdict.estimate;
  return (
    <section
      aria-label="Verdict"
      className="flex flex-col gap-5 overflow-hidden rounded-lg border bg-[linear-gradient(to_top_right,var(--ally-soft)_calc(50%-1px),var(--border)_calc(50%-1px)_calc(50%+1px),var(--enemy-soft)_calc(50%+1px))] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">{first}</div>
        <div className="min-w-0 text-right">{second}</div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-display text-2xl font-bold" aria-live="polite">
          {verdictText(verdict, firstName, secondName)}
        </p>
        <EstimateBar
          first={firstShare}
          firstName={firstName}
          secondName={secondName}
        />
        <p className="text-xs text-muted-foreground">
          Rule-based estimate from the breakdown below, not a prediction.
        </p>
      </div>
    </section>
  );
}

/** Two shares of 100, blue from the left and red from the right, with a gap between. */
export function EstimateBar({
  first,
  firstName,
  secondName,
  className,
}: {
  first: number;
  firstName: string;
  secondName: string;
  className?: string;
}) {
  const second = 100 - first;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex justify-between text-sm font-semibold tabular-nums">
        <span className="text-ally-text">
          <span className="sr-only">{firstName}: </span>
          {first}%
        </span>
        <span className="text-enemy-text">
          <span className="sr-only">{secondName}: </span>
          {second}%
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5" aria-hidden>
        <div
          className="rounded-l-full bg-ally"
          style={{ width: `${first}%` }}
        />
        <div
          className="rounded-r-full bg-enemy"
          style={{ width: `${second}%` }}
        />
      </div>
    </div>
  );
}
