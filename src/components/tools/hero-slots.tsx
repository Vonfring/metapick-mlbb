"use client";

import { PlusIcon, XIcon } from "@/components/icons";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import type { HeroSummary } from "@/lib/data";
import { cn } from "@/lib/utils";

export type TeamSide = "ally" | "enemy";

const sideClasses: Record<TeamSide, { filled: string; empty: string }> = {
  ally: {
    filled: "border-ally",
    empty: "border-ally/50 bg-ally-soft text-ally-text",
  },
  enemy: {
    filled: "border-enemy",
    empty: "border-enemy/50 bg-enemy-soft text-enemy-text",
  },
};

/**
 * A team as a row of slots. A filled slot removes its hero when tapped; an
 * empty one calls `onEmpty`, for example to focus the picker.
 */
export function HeroSlots({
  heroes,
  size,
  side,
  teamName,
  onRemove,
  onEmpty,
  active = false,
}: {
  heroes: readonly HeroSummary[];
  size: number;
  side: TeamSide;
  /** "enemy team", used in button labels. */
  teamName: string;
  onRemove: (hero: HeroSummary) => void;
  onEmpty?: () => void;
  /** Highlights the team the picker adds to. */
  active?: boolean;
}) {
  const classes = sideClasses[side];
  return (
    <ul
      className={cn(
        "grid gap-2",
        size === 1 ? "mx-auto w-full max-w-28 grid-cols-1" : "grid-cols-5",
      )}
      aria-label={teamName}
    >
      {Array.from({ length: size }, (_, i) => {
        const hero = heroes[i];
        return (
          <li key={hero ? hero.id : `empty-${i}`} className="min-w-0">
            {hero ? (
              <button
                type="button"
                onClick={() => onRemove(hero)}
                aria-label={`Remove ${hero.name} from the ${teamName}`}
                className="group flex w-full flex-col items-center gap-1 text-center"
              >
                <span className="relative w-full">
                  <span
                    className={cn(
                      "block rounded-sm border-2 p-0.5 [--clip-size:10px] clip-corner",
                      classes.filled,
                    )}
                  >
                    <HeroAvatar
                      name={hero.name}
                      src={hero.head_image_url}
                      size="md"
                      fluid
                      decorative
                    />
                  </span>
                  <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border bg-surface text-muted-foreground shadow-sm group-hover:text-foreground">
                    <XIcon className="size-3" weight="bold" aria-hidden />
                  </span>
                </span>
                <span className="w-full truncate text-xs font-medium">
                  {hero.name}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onEmpty}
                aria-label={`Empty slot in the ${teamName}`}
                className="flex w-full flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-sm border-2 border-dashed transition-colors",
                    classes.empty,
                    active && "border-solid",
                  )}
                >
                  <PlusIcon className="size-5" aria-hidden />
                </span>
                {/* Keeps empty and filled slots the same height. */}
                <span className="h-[1.05rem]" aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
