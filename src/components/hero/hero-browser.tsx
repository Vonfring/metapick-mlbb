"use client";

import { useMemo } from "react";
import { MagnifyingGlassIcon, UsersThreeIcon } from "@/components/icons";
import { EmptyState } from "@/components/meta/empty-state";
import { Button } from "@/components/ui/button";
import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import type { RankedHero } from "@/lib/data";
import { compareNames, searchKey } from "@/lib/format";
import { oneOf, useUrlParams } from "@/lib/use-url-params";
import {
  HERO_LANES,
  HERO_ROLES,
  type HeroLane,
  type HeroRole,
  laneLabels,
  roleLabels,
} from "@/types/domain";
import { HeroTile } from "./hero-tile";

const SORTS = {
  name: "Name",
  tier: "Tier",
  win: "Win rate",
} as const;
type SortKey = keyof typeof SORTS;

const byName = (a: RankedHero, b: RankedHero) => compareNames(a.name, b.name);
/** Missing values sort last, then by name. */
const desc =
  (pick: (h: RankedHero) => number | null) => (a: RankedHero, b: RankedHero) =>
    (pick(b) ?? -Infinity) - (pick(a) ?? -Infinity) || byName(a, b);

const sorters: Record<SortKey, (a: RankedHero, b: RankedHero) => number> = {
  name: byName,
  tier: desc((h) => h.score),
  win: desc((h) => h.winRate),
};

/** The roster with search, role and lane filters and sorting, kept in the URL. */
export function HeroBrowser({
  heroes,
  context,
}: {
  heroes: RankedHero[];
  context: string;
}) {
  const [params, setParams] = useUrlParams();
  const query = params.get("q") ?? "";
  const role = oneOf<HeroRole>(params.get("role"), HERO_ROLES);
  const lane = oneOf<HeroLane>(params.get("lane"), HERO_LANES);
  const sortParam = params.get("sort");
  // Object.hasOwn, so "?sort=valueOf" cannot pick an Object.prototype method.
  const sort: SortKey =
    sortParam && Object.hasOwn(SORTS, sortParam)
      ? (sortParam as SortKey)
      : "name";

  const roleOptions: ChipOption<HeroRole | "all">[] = [
    { value: "all", label: "All roles" },
    ...HERO_ROLES.map((r) => ({ value: r, label: roleLabels[r] })),
  ];
  const laneOptions: ChipOption<HeroLane | "all">[] = [
    { value: "all", label: "All lanes" },
    ...HERO_LANES.map((l) => ({ value: l, label: laneLabels[l] })),
  ];

  const shown = useMemo(() => {
    const key = searchKey(query);
    return heroes
      .filter(
        (h) =>
          (role === "all" || h.roles.includes(role)) &&
          (lane === "all" || h.lanes.includes(lane)),
      )
      .filter((h) => !key || searchKey(h.name).includes(key))
      .sort(sorters[sort]);
  }, [heroes, query, role, lane, sort]);

  const filtered = query !== "" || role !== "all" || lane !== "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block flex-1 sm:max-w-sm">
            <span className="sr-only">Search heroes</span>
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              placeholder="Search heroes"
              autoComplete="off"
              spellCheck={false}
              className="pl-9"
              onChange={(event) => setParams({ q: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
            Sort by
            <select
              value={sort}
              onChange={(event) =>
                setParams({
                  sort:
                    event.target.value === "name" ? null : event.target.value,
                })
              }
              className="h-10 rounded-md border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ChipGroup
          label="Role"
          options={roleOptions}
          value={role}
          onChange={(value) =>
            setParams({ role: value === "all" ? null : value })
          }
        />
        <ChipGroup
          label="Lane"
          options={laneOptions}
          value={lane}
          onChange={(value) =>
            setParams({ lane: value === "all" ? null : value })
          }
        />
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {filtered
          ? `${shown.length} of ${heroes.length} heroes`
          : `${heroes.length} heroes`}
        . Tiers and win rates: {context}.
      </p>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-3 gap-x-2 gap-y-4 min-[480px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8">
          {shown.map((hero) => (
            <li key={hero.id}>
              <HeroTile hero={hero} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={UsersThreeIcon}
          title="No hero matches these filters"
          description="Try another name, or clear the role and lane filters."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParams({ q: null, role: null, lane: null })}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
}
