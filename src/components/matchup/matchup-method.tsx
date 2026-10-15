import { COMPOSITION_RULES } from "@/config/composition-rules";
import { MATCHUP_SCORING } from "@/config/matchup-scoring";

/** How matchups are judged, written from the config files so it never drifts. */
export function MatchupMethod() {
  const {
    metaWeight,
    countersWeight,
    synergyWeight,
    compositionPoints,
    estimateRange,
    evenBelow,
    clearFrom,
  } = MATCHUP_SCORING;
  return (
    <details className="group rounded-lg border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
        How the comparison works
      </summary>
      <div className="flex max-w-[68ch] flex-col gap-3 border-t px-4 py-4 text-sm text-muted-foreground">
        <p>
          Everything is counted in points, where one point is about one
          percentage point of win rate. Two heroes are compared with the same
          edge Counter pick uses (matchup statistics, official notes and hero
          tags), plus {metaWeight} points per percentage point of difference in
          adjusted win rate.
        </p>
        <p>Two teams add up four parts:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Current form: each hero&apos;s adjusted win rate above or below 50%,
            times {metaWeight}.
          </li>
          <li>
            Counters: the edge of every blue hero against every red hero, times{" "}
            {countersWeight}.
          </li>
          <li>
            Synergy: the win rate change of every teammate pair with numbers,
            times {synergyWeight}.
          </li>
          <li>
            Composition: once both teams have five heroes, the difference in the
            share of checks passed (
            {COMPOSITION_RULES.checks
              .map((c) => c.label.toLowerCase())
              .join(", ")}
            ), times {compositionPoints}.
          </li>
        </ul>
        <p>
          The estimate is 50% plus the total, kept between {estimateRange[0]}%
          and {estimateRange[1]}%. Totals under {evenBelow} point read as even,
          and from {clearFrom} points as clearly favored. It is a rule-based
          estimate to explain a draft, not a prediction of the game.
        </p>
      </div>
    </details>
  );
}
