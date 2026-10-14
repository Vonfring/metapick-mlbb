import type { Tier } from "@/types/domain";
import { cn } from "@/lib/utils";

const tierClasses: Record<Tier, string> = {
  SS: "bg-tier-ss text-tier-ss-foreground",
  S: "bg-tier-s text-tier-s-foreground",
  A: "bg-tier-a text-tier-a-foreground",
  B: "bg-tier-b text-tier-b-foreground",
  C: "bg-tier-c text-tier-c-foreground",
  D: "bg-tier-d text-tier-d-foreground",
};

const sizeClasses = {
  sm: "h-6 min-w-6 px-1 text-xs [--clip-size:5px]",
  md: "h-8 min-w-8 px-1.5 text-sm [--clip-size:7px]",
  lg: "h-12 min-w-12 px-2 text-xl [--clip-size:10px]",
} as const;

export function TierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: Tier;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm font-display leading-none font-bold clip-corner",
        tierClasses[tier],
        sizeClasses[size],
        className,
      )}
    >
      <span className="sr-only">Tier </span>
      {tier}
    </span>
  );
}
