import { COMPOSITION_RULES } from "@/config/composition-rules";
import { DRAFT_SCORING } from "@/config/draft-scoring";

/** How the checklist, suggestions and strength work, written from the config files. */
export function CompositionMethod({
  title = "How the checklist and suggestions work",
}: {
  title?: string;
}) {
  const { metaWeight, compositionPoints, teammateNotePoints, strength } =
    DRAFT_SCORING;
  return (
    <details className="group rounded-lg border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
        {title}
      </summary>
      <div className="flex max-w-[72ch] flex-col gap-4 border-t px-4 py-4 text-sm text-muted-foreground">
        <p>
          Each hero has curated tags from 0 to 3 (frontline, crowd control, peel
          and so on). A check adds up one tag over the team. Lanes come from the
          official hero data, and a team passes when every hero can take a lane
          of its own.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left">
            <thead className="bg-surface-2 text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Check
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  OK from
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Weak from
                </th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {COMPOSITION_RULES.checks.map((check) => (
                <tr key={check.id}>
                  <th scope="row" className="px-3 py-1.5 font-normal">
                    {check.label}
                  </th>
                  <td className="px-3 py-1.5 text-right">
                    {check.kind === "tag"
                      ? check.ok
                      : check.kind === "lanes"
                        ? "every hero"
                        : "1.5 of each"}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {check.kind === "tag"
                      ? check.weak
                      : check.kind === "lanes"
                        ? "one short"
                        : "0.5 of each"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Suggested heroes are ranked by points: how much the checklist score
          rises (times {compositionPoints}), the win rate change with each
          teammate plus {teammateNotePoints} for an official &ldquo;best
          teammate&rdquo; note, the edge against enemy picks when there are any,
          and {metaWeight} per percentage point of adjusted win rate above 50%.
        </p>
        <p>
          Team strength out of 100: {strength.composition} for the share of
          checks passed, {strength.form} for how the heroes rank by adjusted win
          rate, and {strength.synergy} for synergy, which starts at 50% and
          moves {100 / strength.synergyScale}% per point of win rate change
          between teammates.
        </p>
      </div>
    </details>
  );
}
