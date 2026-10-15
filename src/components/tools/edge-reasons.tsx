import { RateDelta } from "@/components/meta/rate-delta";
import type { ReasonLine } from "@/lib/scoring/explain";
import { cn } from "@/lib/utils";

/** Points with an arrow (one point is about one percentage point of win rate). */
export function Points({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return <RateDelta delta={value / 100} className={className} />;
}

/** The reasons behind an edge, each with its points. */
export function ReasonList({
  lines,
  empty,
  className,
}: {
  lines: ReasonLine[];
  empty: string;
  className?: string;
}) {
  if (lines.length === 0)
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>
    );
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {lines.map((line, i) => (
        <li
          key={i}
          className="grid grid-cols-[3.25rem_1fr] items-baseline gap-2 text-sm"
        >
          <Points value={line.points} className="justify-end" />
          <span>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}
