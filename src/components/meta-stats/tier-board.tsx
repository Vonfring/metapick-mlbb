import Link from "next/link";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import type { MetaRow } from "@/lib/meta/meta-rows";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeroSummary } from "@/lib/data";
import { TIERS, type Tier } from "@/types/domain";

const tierBand: Record<Tier, string> = {
  SS: "bg-tier-ss text-tier-ss-foreground",
  S: "bg-tier-s text-tier-s-foreground",
  A: "bg-tier-a text-tier-a-foreground",
  B: "bg-tier-b text-tier-b-foreground",
  C: "bg-tier-c text-tier-c-foreground",
  D: "bg-tier-d text-tier-d-foreground",
};

function HeroCell({ hero, row }: { hero: HeroSummary; row: MetaRow }) {
  return (
    <li>
      <Link
        href={`/heroes/${hero.slug}`}
        className="group flex w-14 flex-col items-center gap-1 rounded-md p-0.5 text-center sm:w-16"
        title={`${hero.name}: win rate ${formatPercent(row.winRate)}, pick rate ${formatPercent(row.pickRate, 2)}, ban rate ${formatPercent(row.banRate)}`}
      >
        <HeroAvatar
          name={hero.name}
          src={hero.head_image_url}
          size="md"
          fluid
          decorative
        />
        <span className="w-full truncate text-xs font-medium group-hover:text-ally-text">
          {hero.name}
        </span>
        <span className="text-[0.6875rem] leading-none text-muted-foreground tabular-nums">
          {formatPercent(row.winRate)}
        </span>
      </Link>
    </li>
  );
}

/** Heroes in tier rows, SS to D, strongest first within each tier. */
export function TierBoard({
  heroes,
  rows,
}: {
  heroes: Map<number, HeroSummary>;
  rows: MetaRow[];
}) {
  const unranked = rows.filter((r) => r.tier === null);
  return (
    <div className="flex flex-col gap-2">
      {TIERS.map((tier) => {
        const inTier = rows.filter((r) => r.tier === tier);
        return (
          <section
            key={tier}
            aria-label={`Tier ${tier}`}
            className="grid grid-cols-[3rem_minmax(0,1fr)] overflow-hidden rounded-lg border bg-surface sm:grid-cols-[4.5rem_minmax(0,1fr)]"
          >
            <div
              className={cn(
                "flex items-center justify-center font-display text-2xl font-bold sm:text-3xl",
                tierBand[tier],
              )}
              aria-hidden
            >
              {tier}
            </div>
            {inTier.length > 0 ? (
              <ul className="flex flex-wrap gap-x-1.5 gap-y-3 p-2.5 sm:gap-x-2 sm:p-3">
                {inTier.map((row) => {
                  const hero = heroes.get(row.id);
                  return hero ? (
                    <HeroCell key={row.id} hero={hero} row={row} />
                  ) : null;
                })}
              </ul>
            ) : (
              <p className="self-center p-3 text-sm text-muted-foreground">
                No heroes in this tier.
              </p>
            )}
          </section>
        );
      })}
      {unranked.length > 0 ? (
        <section
          aria-labelledby="rarely-picked"
          className="mt-4 flex flex-col gap-2"
        >
          <div className="flex flex-col gap-0.5">
            <h2
              id="rarely-picked"
              className="font-display text-lg font-semibold"
            >
              Rarely picked
            </h2>
            <p className="text-sm text-muted-foreground">
              Picked in too few games to rank fairly, so they have no tier.
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-1.5 gap-y-3 rounded-lg border bg-surface p-2.5 sm:gap-x-2 sm:p-3">
            {unranked.map((row) => {
              const hero = heroes.get(row.id);
              return hero ? (
                <HeroCell key={row.id} hero={hero} row={row} />
              ) : null;
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
