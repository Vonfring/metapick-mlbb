import Link from "next/link";
import type * as React from "react";
import { CaretDownIcon, CheckCircleIcon } from "@/components/icons";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { TierBadge } from "@/components/meta/tier-badge";
import { Points, ReasonList } from "@/components/tools/edge-reasons";
import type { HeroSummary } from "@/lib/data";
import { formatPercent, formatPoints } from "@/lib/format";
import type { CheckStatus } from "@/lib/scoring/composition";
import type { CheckChange, PickSuggestion } from "@/lib/scoring/draft";
import { edgeLines } from "@/lib/scoring/explain";
import type { HeroIndex } from "@/lib/scoring/hero-index";

const statusWord: Record<CheckStatus, string> = {
  ok: "OK",
  weak: "weak",
  missing: "missing",
};

/** "Frontline OK", one chip per check a hero improves. */
export function FixList({ fixes }: { fixes: CheckChange[] }) {
  if (fixes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Checks it improves">
      {fixes.map((fix) => (
        <li
          key={fix.id}
          className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs"
        >
          <CheckCircleIcon
            className="size-3.5 text-positive"
            weight="fill"
            aria-hidden
          />
          {fix.label} {statusWord[fix.to]}
        </li>
      ))}
    </ul>
  );
}

/** One suggested hero with its score and, behind "Why", the reasons. */
export function PickSuggestionRow({
  rank,
  suggestion,
  hero,
  index,
  nameOf,
  rankLabel,
  action,
}: {
  rank: number;
  suggestion: PickSuggestion;
  hero: HeroSummary;
  index: HeroIndex;
  nameOf: (heroId: number) => string;
  /** "Mythic", for the form line. */
  rankLabel: string;
  /** A button such as "Add" or "Pick". */
  action?: React.ReactNode;
}) {
  const meta = index.meta.get(hero.id);
  const { parts } = suggestion;
  return (
    <li className="rounded-lg border bg-surface">
      {/* The checks a hero fixes get a row of their own under the name. */}
      <div className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3">
        <span className="text-right font-display text-sm font-semibold text-muted-foreground tabular-nums">
          {rank}
        </span>
        <HeroAvatar
          name={hero.name}
          src={hero.head_image_url}
          size="sm"
          decorative
        />
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            href={`/heroes/${hero.slug}`}
            className="truncate font-medium hover:text-ally-text"
          >
            {hero.name}
          </Link>
          {meta?.tier ? <TierBadge tier={meta.tier} size="sm" /> : null}
          {!suggestion.laneFit ? (
            <span className="text-xs text-muted-foreground">No open lane</span>
          ) : null}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex flex-col items-end">
            <span className="font-display text-lg font-bold tabular-nums">
              {formatPoints(suggestion.score)}
            </span>
            <span className="text-xs text-muted-foreground">score</span>
          </span>
          {action}
        </span>
        {suggestion.fixes.length > 0 ? (
          <div className="col-span-full sm:col-start-3">
            <FixList fixes={suggestion.fixes} />
          </div>
        ) : null}
      </div>
      <details className="group border-t">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <CaretDownIcon
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
          Why {hero.name}
        </summary>
        <div className="flex flex-col gap-4 px-3 pb-4 sm:pl-11">
          <Part label="Composition" points={parts.composition}>
            <p className="text-sm text-muted-foreground">
              {suggestion.fixes.length > 0
                ? `Improves ${suggestion.fixes
                    .map(
                      (f) =>
                        `${f.label.toLowerCase()} from ${statusWord[f.from]} to ${statusWord[f.to]}`,
                    )
                    .join(", ")}.`
                : parts.composition < 0
                  ? "Makes the checklist worse, usually by doubling up a lane."
                  : "Adds to the team's tag totals without changing a check."}
            </p>
          </Part>
          {suggestion.edges.length > 0 ? (
            <Part label="Counters" points={parts.counters}>
              {suggestion.edges.map((edge) => (
                <div key={edge.opponentId} className="flex flex-col gap-1">
                  <h5 className="flex items-center gap-2 text-sm">
                    Against {nameOf(edge.opponentId)}
                    <Points value={edge.points.total} />
                  </h5>
                  <ReasonList
                    lines={edgeLines(edge, nameOf)}
                    empty="No statistics, official notes or tag effects for this pair."
                  />
                </div>
              ))}
            </Part>
          ) : null}
          <Part label="Synergy" points={parts.synergy}>
            <ReasonList
              lines={suggestion.links.map((link) => ({
                points: link.points,
                text: [
                  link.delta !== null
                    ? `Win rate with ${nameOf(link.teammateId)} changes ${formatPoints(link.delta * 100)} points`
                    : null,
                  link.note
                    ? `Official note: good with ${nameOf(link.teammateId)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("; "),
              }))}
              empty="No numbers or official notes with the heroes already picked."
            />
          </Part>
          <Part label="Current form" points={parts.meta}>
            <p className="text-sm text-muted-foreground">
              {meta
                ? `Adjusted win rate ${formatPercent(meta.adjustedWinRate)} in ${rankLabel}.`
                : `No statistics in ${rankLabel} yet.`}
            </p>
          </Part>
        </div>
      </details>
    </li>
  );
}

function Part({
  label,
  points,
  children,
}: {
  label: string;
  points: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="flex items-center gap-2 text-sm font-medium">
        {label}
        <Points value={points} />
      </h4>
      {children}
    </div>
  );
}
