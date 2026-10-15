import { cn } from "@/lib/utils";

/** A labeled 0 to max bar. One neutral hue: the value is read from the number, not the color. */
export function Meter({
  label,
  value,
  max = 100,
  display,
  className,
}: {
  label: string;
  value: number;
  max?: number;
  display?: string;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{display ?? value}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full bg-foreground/75"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** A 0 to 3 level as three steps, for the curated composition tags. */
export function LevelSteps({ label, level }: { label: string; level: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="flex gap-1"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-valuenow={level}
      >
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "h-2 w-5 rounded-full",
              step <= level ? "bg-foreground/75" : "bg-muted",
            )}
          />
        ))}
      </span>
    </div>
  );
}
