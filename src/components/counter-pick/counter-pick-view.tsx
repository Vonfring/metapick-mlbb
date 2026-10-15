"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CaretDownIcon, CrosshairIcon } from "@/components/icons";
import { SnapshotNote } from "@/components/meta-stats/snapshot-note";
import { EmptyState } from "@/components/meta/empty-state";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { RankSelect } from "@/components/meta/rank-select";
import { TierBadge } from "@/components/meta/tier-badge";
import { Points, ReasonList } from "@/components/tools/edge-reasons";
import { HeroPicker } from "@/components/tools/hero-picker";
import { HeroSlots } from "@/components/tools/hero-slots";
import { useToolData } from "@/components/tools/use-tool-data";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { DEFAULT_BRACKET } from "@/config/filters";
import type { HeroKnowledge, HeroSummary, MatchupSnapshot } from "@/lib/data";
import { formatPercent, formatPoints } from "@/lib/format";
import { heroListParam, parseHeroList } from "@/lib/hero-list-param";
import { TEAM_SIZE } from "@/lib/scoring/composition";
import { type CounterPick, rankCounters } from "@/lib/scoring/counter";
import { edgeLines } from "@/lib/scoring/explain";
import type { HeroIndex } from "@/lib/scoring/hero-index";
import { oneOf, rankParam, useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";
import {
  bracketLabels,
  HERO_LANES,
  HERO_ROLES,
  type HeroLane,
  type HeroRole,
  laneLabels,
  type RankBracket,
  roleLabels,
} from "@/types/domain";

const PAGE_SIZE = 10;
const WEAKEST_SHOWN = 3;

const roleOptions: ChipOption<HeroRole | "all">[] = [
  { value: "all", label: "All roles" },
  ...HERO_ROLES.map((r) => ({ value: r, label: roleLabels[r] })),
];
const laneOptions: ChipOption<HeroLane | "all">[] = [
  { value: "all", label: "All lanes" },
  ...HERO_LANES.map((l) => ({ value: l, label: laneLabels[l] })),
];

/** Counter pick: enemies in, ranked counters out. State lives in the URL. */
export function CounterPickView({
  heroes,
  knowledge,
  initial,
}: {
  heroes: HeroSummary[];
  knowledge: HeroKnowledge;
  initial: MatchupSnapshot;
}) {
  const [params, setParams] = useUrlParams();
  const bracket = rankParam(params.get("rank"));
  const role = oneOf<HeroRole>(params.get("role"), HERO_ROLES);
  const lane = oneOf<HeroLane>(params.get("lane"), HERO_LANES);
  const bySlug = useMemo(
    () => new Map(heroes.map((h) => [h.slug, h])),
    [heroes],
  );
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const enemies = parseHeroList(params.get("enemies"), bySlug, TEAM_SIZE);
  const enemyKey = enemies.map((e) => e.id).join(",");
  const { snapshot, index, popular, loading, error } = useToolData(
    heroes,
    knowledge,
    initial,
    bracket,
  );
  const searchRef = useRef<HTMLInputElement>(null);

  const setEnemies = (next: HeroSummary[]) =>
    setParams({ enemies: heroListParam(next) });

  const picks = useMemo(() => {
    if (!enemyKey) return [];
    // Tiers and meta use every hero; role and lane only narrow the suggestions.
    const candidates = heroes
      .filter(
        (h) =>
          (role === "all" || h.roles.includes(role)) &&
          (lane === "all" || h.lanes.includes(lane)),
      )
      .map((h) => h.id);
    return rankCounters(index, enemyKey.split(",").map(Number), candidates);
  }, [enemyKey, heroes, index, role, lane]);

  const full = enemies.length >= TEAM_SIZE;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby="enemy-team-heading"
        className="flex flex-col gap-4 lg:sticky lg:top-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="enemy-team-heading"
            className="font-display text-lg font-semibold"
          >
            Enemy team
          </h2>
          {enemies.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setEnemies([])}>
              Clear
            </Button>
          ) : null}
        </div>
        <HeroSlots
          heroes={enemies}
          size={TEAM_SIZE}
          side="enemy"
          teamName="enemy team"
          onRemove={(hero) => setEnemies(enemies.filter((e) => e !== hero))}
          onEmpty={() => searchRef.current?.focus()}
        />
        <HeroPicker
          inputRef={searchRef}
          heroes={popular}
          taken={new Set(enemies.map((e) => e.id))}
          onPick={(hero) => setEnemies([...enemies, hero])}
          placeholder="Search enemy heroes"
          caption={`Most picked in ${bracketLabels[snapshot.bracket]} first.`}
          actionLabel={(name) => `Add ${name} to the enemy team`}
          blocked={
            full
              ? "The enemy team is full. Tap a hero above to remove it."
              : null
          }
        />
      </section>

      <section
        aria-labelledby="counters-heading"
        className="flex min-w-0 flex-col gap-4"
      >
        <h2
          id="counters-heading"
          className="font-display text-lg font-semibold"
        >
          Best counters
        </h2>
        <div className="flex flex-col gap-3">
          <RankSelect
            className="sm:max-w-56"
            value={bracket}
            onChange={(next) =>
              setParams({ rank: next === DEFAULT_BRACKET ? null : next })
            }
          />
          <ChipGroup
            label="Role of the suggested heroes"
            options={roleOptions}
            value={role}
            onChange={(value) =>
              setParams({ role: value === "all" ? null : value })
            }
          />
          <ChipGroup
            label="Lane of the suggested heroes"
            options={laneOptions}
            value={lane}
            onChange={(value) =>
              setParams({ lane: value === "all" ? null : value })
            }
          />
        </div>
        <SnapshotNote data={snapshot} loading={loading} error={error} />

        <div
          aria-busy={loading}
          className={cn("transition-opacity", loading && "opacity-60")}
        >
          {enemies.length === 0 ? (
            <EmptyState
              icon={CrosshairIcon}
              title="Add an enemy hero to start"
              description="Pick up to five enemies. Counters are ranked by matchup statistics, official hero notes and hero tags, and each one shows why."
            />
          ) : picks.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-surface/60 p-6 text-sm text-muted-foreground">
              No hero matches this role and lane.
            </p>
          ) : (
            <CounterResults
              key={`${enemyKey}/${role}/${lane}`}
              picks={picks}
              index={index}
              byId={byId}
              bracket={snapshot.bracket}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CounterResults({
  picks,
  index,
  byId,
  bracket,
}: {
  picks: CounterPick[];
  index: HeroIndex;
  byId: ReadonlyMap<number, HeroSummary>;
  bracket: RankBracket;
}) {
  const [count, setCount] = useState(PAGE_SIZE);
  const nameOf = (id: number) => byId.get(id)?.name ?? "Unknown hero";
  // The weakest picks only show when the list is long enough to set them apart.
  const weakest =
    picks.length > PAGE_SIZE + WEAKEST_SHOWN
      ? picks.slice(-WEAKEST_SHOWN).reverse()
      : [];
  const listable = picks.length - weakest.length;
  const shown = picks.slice(0, Math.min(count, listable));

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-2">
        {shown.map((pick, i) => (
          <CounterRow
            key={pick.heroId}
            rank={i + 1}
            pick={pick}
            index={index}
            byId={byId}
            nameOf={nameOf}
            bracket={bracket}
          />
        ))}
      </ol>
      {shown.length < listable ? (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setCount((c) => c + PAGE_SIZE)}
        >
          Show {Math.min(PAGE_SIZE, listable - shown.length)} more
        </Button>
      ) : null}
      {weakest.length > 0 ? (
        <section
          aria-labelledby="weakest-heading"
          className="flex flex-col gap-2"
        >
          <h3 id="weakest-heading" className="font-medium">
            Weakest picks into this team
          </h3>
          <ul className="flex flex-col divide-y rounded-lg border bg-surface">
            {weakest.map((pick) => {
              const hero = byId.get(pick.heroId);
              if (!hero) return null;
              return (
                <li key={pick.heroId}>
                  <Link
                    href={`/heroes/${hero.slug}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2"
                  >
                    <HeroAvatar
                      name={hero.name}
                      src={hero.head_image_url}
                      size="xs"
                      decorative
                    />
                    <span className="flex-1 truncate font-medium">
                      {hero.name}
                    </span>
                    <span className="font-display font-semibold tabular-nums">
                      {formatPoints(pick.score)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CounterRow({
  rank,
  pick,
  index,
  byId,
  nameOf,
  bracket,
}: {
  rank: number;
  pick: CounterPick;
  index: HeroIndex;
  byId: ReadonlyMap<number, HeroSummary>;
  nameOf: (id: number) => string;
  bracket: RankBracket;
}) {
  const hero = byId.get(pick.heroId);
  if (!hero) return null;
  const meta = index.meta.get(pick.heroId);
  return (
    <li className="rounded-lg border bg-surface">
      {/* On phones the edges get a row of their own; from sm up they sit under the name. */}
      <div className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3">
        <span className="text-right font-display text-sm font-semibold text-muted-foreground tabular-nums sm:row-span-2">
          {rank}
        </span>
        <HeroAvatar
          name={hero.name}
          src={hero.head_image_url}
          size="md"
          decorative
          className="sm:row-span-2"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:self-end">
          <Link
            href={`/heroes/${hero.slug}`}
            className="truncate font-medium hover:text-ally-text"
          >
            {hero.name}
          </Link>
          {meta?.tier ? <TierBadge tier={meta.tier} size="sm" /> : null}
          {pick.limitedData ? (
            <span className="text-xs text-muted-foreground">
              {index.tags.has(pick.heroId) ? "Tags and meta only" : "Meta only"}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col items-end sm:row-span-2">
          <span className="font-display text-xl font-bold tabular-nums">
            {formatPoints(pick.score)}
          </span>
          <span className="text-xs text-muted-foreground">score</span>
        </div>
        <ul className="col-span-full flex flex-wrap gap-x-3 gap-y-1 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:self-start">
          {pick.edges.map((edge) => {
            const enemy = byId.get(edge.opponentId);
            return (
              <li key={edge.opponentId} className="flex items-center gap-1">
                <HeroAvatar
                  name={enemy?.name ?? "?"}
                  src={enemy?.head_image_url}
                  size="xxs"
                  decorative
                />
                <span className="sr-only">
                  Against {nameOf(edge.opponentId)}:
                </span>
                <Points value={edge.points.total} />
              </li>
            );
          })}
        </ul>
      </div>
      <details className="group border-t">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <CaretDownIcon
            className="size-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
          Why {hero.name}
        </summary>
        <div className="flex flex-col gap-4 px-3 pb-4 sm:pl-11">
          {pick.edges.map((edge) => (
            <div key={edge.opponentId} className="flex flex-col gap-1.5">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                Against {nameOf(edge.opponentId)}
                <Points value={edge.points.total} />
              </h4>
              <ReasonList
                lines={edgeLines(edge, nameOf)}
                empty="No statistics, official notes or tag effects for this pair."
              />
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-sm font-medium">Current form</h4>
            <ReasonList
              lines={[
                {
                  points: pick.metaPoints,
                  text: meta
                    ? `Adjusted win rate ${formatPercent(meta.adjustedWinRate)} in ${bracketLabels[bracket]}`
                    : `No statistics in ${bracketLabels[bracket]} yet`,
                },
              ]}
              empty=""
            />
          </div>
        </div>
      </details>
    </li>
  );
}
