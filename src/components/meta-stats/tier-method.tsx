import { TIER_SCORING } from "@/config/tier-scoring";
import { formatPercent } from "@/lib/format";

const percent = (n: number) => `${Math.round(n * 100)}%`;

/** How tiers are calculated, written from src/config/tier-scoring.ts so it never drifts. */
export function TierMethod() {
  const { weights, cutoffs, shrinkage, minPickRate } = TIER_SCORING;
  const bands = cutoffs.map(([tier, from], i) => {
    const to = i === 0 ? 100 : cutoffs[i - 1]![1];
    return { tier, share: to - from, top: i === 0 };
  });
  return (
    <details className="group rounded-lg border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
        How tiers are calculated
      </summary>
      <div className="flex max-w-[68ch] flex-col gap-3 border-t px-4 py-4 text-sm text-muted-foreground">
        <p>
          Each hero gets a score from three numbers in the chosen rank and
          period: win rate counts {percent(weights.winRate)}, ban rate{" "}
          {percent(weights.banRate)} and pick rate {percent(weights.pickRate)}.
          Every number is compared with all heroes in the same rank and period,
          so a tier means strong for that rank right now.
        </p>
        <p>
          A win rate from few games is less certain, so it is pulled toward 50%.
          A hero with {formatPercent(shrinkage)} of all picks counts half its
          own win rate and half 50%.
        </p>
        <p>
          Heroes are then sorted by score:{" "}
          {bands
            .map(({ tier, share, top }, i) =>
              top
                ? `the top ${share}% are ${tier}`
                : i === bands.length - 1
                  ? `and the last ${share}% are ${tier}`
                  : `the next ${share}% ${tier}`,
            )
            .join(", ")}
          . Heroes with under {formatPercent(minPickRate)} of all picks are
          listed as rarely picked.
        </p>
      </div>
    </details>
  );
}
