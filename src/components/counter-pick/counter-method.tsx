import { COUNTER_SCORING } from "@/config/counter-scoring";

const points = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;

/** How counters are scored, written from src/config/counter-scoring.ts so it never drifts. */
export function CounterMethod() {
  const { statsWeight, relationPoints, tagRules, metaWeight } = COUNTER_SCORING;
  return (
    <details className="group rounded-lg border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
        How the score works
      </summary>
      <div className="flex max-w-[68ch] flex-col gap-3 border-t px-4 py-4 text-sm text-muted-foreground">
        <p>
          The score adds up how a hero does against each enemy, plus a little
          for current form. One point is about one percentage point of win rate.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Statistics: {points(statsWeight)} per percentage point the win rate
            changes when the two heroes meet. The official data lists each
            hero&apos;s five best and five worst matchups, so many pairs have no
            number.
          </li>
          <li>
            Official notes: {points(relationPoints)} when a hero&apos;s page
            says it is strong against the enemy, or the enemy&apos;s page says
            it is weak against the hero. The opposite notes take the same away.
          </li>
          <li>
            Hero tags: {tagRules.map((r) => r.label.toLowerCase()).join("; ")}.
            Each is worth up to{" "}
            {points(Math.max(...tagRules.map((r) => r.points)))} when both
            heroes are at the top of the scale, and counts against the hero when
            the enemy has the edge.
          </li>
          <li>
            Meta: {points(metaWeight)} per percentage point of adjusted win rate
            above 50%, the same win rate the tier list uses.
          </li>
        </ul>
        <p>
          Heroes with no statistics or official note against any of the enemies
          are marked &ldquo;Tags and meta only&rdquo;.
        </p>
      </div>
    </details>
  );
}
