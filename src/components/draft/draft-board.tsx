"use client";

import { PlusIcon } from "@/components/icons";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import type { DraftTeam } from "@/config/draft-order";
import type { HeroSummary } from "@/lib/data";
import { type DraftStep, SKIP, type Slot } from "@/lib/draft/board";
import type { TeamStrength } from "@/lib/scoring/draft";
import { cn } from "@/lib/utils";
import { LockIn } from "./lock-in";

export const teamName: Record<DraftTeam, string> = {
  blue: "Blue team",
  red: "Red team",
};

const tone: Record<DraftTeam, { border: string; text: string; soft: string }> =
  {
    blue: {
      border: "border-ally",
      text: "text-ally-text",
      soft: "bg-ally-soft",
    },
    red: {
      border: "border-enemy",
      text: "text-enemy-text",
      soft: "bg-enemy-soft",
    },
  };

type SlotView = { step: DraftStep; hero: Slot };

/** One team on the board: its bans in a small row, its picks below. */
export function DraftTeamPanel({
  team,
  isYou,
  steps,
  slots,
  byId,
  current,
  justPlaced,
  strength,
  align,
}: {
  team: DraftTeam;
  isYou: boolean;
  steps: readonly DraftStep[];
  slots: readonly Slot[];
  byId: ReadonlyMap<number, HeroSummary>;
  current: DraftStep | null;
  justPlaced: number | null;
  strength: TeamStrength | null;
  align: "start" | "end";
}) {
  const view = (action: "ban" | "pick"): SlotView[] =>
    steps
      .filter((s) => s.team === team && s.action === action)
      .map((step) => ({ step, hero: slots[step.index]! }));
  const t = tone[team];
  return (
    <section
      aria-label={`${teamName[team]}${isYou ? " (you)" : ""}`}
      className={cn(
        "flex flex-col gap-3",
        align === "end" ? "items-end text-right" : "items-start",
      )}
    >
      <div
        className={cn(
          "flex w-full items-baseline gap-3",
          align === "end" ? "flex-row-reverse" : "flex-row",
        )}
      >
        <h2 className={cn("font-display text-lg font-semibold", t.text)}>
          {teamName[team]}
          {isYou ? (
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">
              (you)
            </span>
          ) : null}
        </h2>
        <span className="text-sm text-muted-foreground">
          Strength{" "}
          <span className="font-display text-base font-bold text-foreground tabular-nums">
            {strength ? strength.total : "—"}
          </span>
        </span>
      </div>
      <ul
        className={cn("flex gap-1.5", align === "end" && "flex-row-reverse")}
        aria-label={`${teamName[team]} bans`}
      >
        {view("ban").map(({ step, hero }) => (
          <li key={step.index}>
            <BanSlot
              hero={hero === null || hero === SKIP ? hero : byId.get(hero)}
              isCurrent={current?.index === step.index}
              play={justPlaced === step.index}
              team={team}
            />
          </li>
        ))}
      </ul>
      <ul
        className="grid w-full max-w-md grid-cols-5 gap-2"
        aria-label={`${teamName[team]} picks`}
      >
        {view("pick").map(({ step, hero }) => {
          const summary =
            hero === null || hero === SKIP ? null : byId.get(hero);
          const isCurrent = current?.index === step.index;
          return (
            <li
              key={step.index}
              className="flex min-w-0 flex-col items-center gap-1"
            >
              {summary ? (
                <LockIn play={justPlaced === step.index} className="w-full">
                  <span
                    className={cn(
                      "block rounded-sm border-2 p-0.5 [--clip-size:10px] clip-corner",
                      t.border,
                    )}
                  >
                    <HeroAvatar
                      name={summary.name}
                      src={summary.head_image_url}
                      size="md"
                      fluid
                      decorative
                    />
                  </span>
                </LockIn>
              ) : (
                <span
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-sm border-2",
                    isCurrent
                      ? cn("border-solid", t.border, t.soft)
                      : "border-dashed border-border",
                  )}
                >
                  {isCurrent ? (
                    <PlusIcon className={cn("size-5", t.text)} aria-hidden />
                  ) : null}
                  <span className="sr-only">
                    {isCurrent ? "Picking now" : "Pick not made yet"}
                  </span>
                </span>
              )}
              <span className="w-full truncate text-center text-xs font-medium">
                {summary?.name ?? " "}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BanSlot({
  hero,
  isCurrent,
  play,
  team,
}: {
  hero: HeroSummary | null | undefined | typeof SKIP;
  isCurrent: boolean;
  play: boolean;
  team: DraftTeam;
}) {
  const t = tone[team];
  if (hero === SKIP)
    return (
      <span
        className="flex size-8 items-center justify-center rounded-sm border text-xs text-muted-foreground"
        title="No ban"
      >
        <span aria-hidden>{"—"}</span>
        <span className="sr-only">No ban</span>
      </span>
    );
  if (!hero)
    return (
      <span
        className={cn(
          "block size-8 rounded-sm border-2",
          isCurrent ? cn("border-solid", t.border, t.soft) : "border-dashed",
        )}
      >
        <span className="sr-only">
          {isCurrent ? "Banning now" : "Ban not made yet"}
        </span>
      </span>
    );
  return (
    <LockIn play={play}>
      <span className="relative block" title={`${hero.name} banned`}>
        <HeroAvatar
          name={hero.name}
          src={hero.head_image_url}
          size="xs"
          className="opacity-60 grayscale"
        />
        {/* A diagonal strike, the board's motif, marks a ban. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),var(--negative)_calc(50%-1px)_calc(50%+1px),transparent_calc(50%+1px))]"
        />
      </span>
    </LockIn>
  );
}
