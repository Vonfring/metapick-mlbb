import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Change between two rates, shown in percentage points with an arrow so the
 * direction never depends on color alone. `delta` is a fraction (0.012 = +1.2).
 */
export function RateDelta({
  delta,
  className,
  digits = 1,
}: {
  delta: number | null | undefined;
  className?: string;
  digits?: number;
}) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return (
      <span
        className={cn("text-xs text-muted-foreground", className)}
        title="Not enough history yet"
      >
        n/a
      </span>
    );
  }

  const points = delta * 100;
  const rounded = Number(points.toFixed(digits));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const Icon =
    direction === "up"
      ? ArrowUpIcon
      : direction === "down"
        ? ArrowDownIcon
        : MinusIcon;
  const label =
    direction === "flat"
      ? "No change"
      : `${direction === "up" ? "Up" : "Down"} ${Math.abs(rounded).toFixed(digits)} points`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        direction === "up" && "text-positive",
        direction === "down" && "text-negative",
        direction === "flat" && "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5" weight="bold" aria-hidden />
      <span aria-hidden>{Math.abs(rounded).toFixed(digits)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
