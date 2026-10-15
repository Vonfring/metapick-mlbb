"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MagnifyingGlassIcon,
} from "@/components/icons";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { RateDelta } from "@/components/meta/rate-delta";
import { TierBadge } from "@/components/meta/tier-badge";
import { Input } from "@/components/ui/input";
import type { HeroSummary, MetaSnapshot } from "@/lib/data";
import { compareNames, formatPercent, searchKey } from "@/lib/format";
import type { MetaRow, Rates } from "@/lib/meta/meta-rows";
import { cn } from "@/lib/utils";
import { MetaFilters, useMetaFilters } from "./meta-filters";
import { SnapshotNote } from "./snapshot-note";
import { useMetaSnapshot } from "./use-meta-snapshot";

const SORTS = {
  name: { label: "Hero", short: "Hero", firstDir: "asc" },
  tier: { label: "Tier", short: "Tier", firstDir: "desc" },
  win: { label: "Win rate", short: "Win", firstDir: "desc" },
  pick: { label: "Pick rate", short: "Pick", firstDir: "desc" },
  ban: { label: "Ban rate", short: "Ban", firstDir: "desc" },
} as const;
type SortKey = keyof typeof SORTS;
type Dir = "asc" | "desc";

type Row = MetaRow & { hero: HeroSummary };

const value: Record<Exclude<SortKey, "name">, (r: Row) => number | null> = {
  tier: (r) => r.score,
  win: (r) => r.winRate,
  pick: (r) => r.pickRate,
  ban: (r) => r.banRate,
};

function sortRows(rows: Row[], key: SortKey, dir: Dir) {
  const sign = dir === "asc" ? 1 : -1;
  const byName = (a: Row, b: Row) => compareNames(a.hero.name, b.hero.name);
  if (key === "name") return [...rows].sort((a, b) => sign * byName(a, b));
  const pick = value[key];
  // Missing values (heroes without a tier) always go last.
  return [...rows].sort((a, b) => {
    const x = pick(a);
    const y = pick(b);
    if (x === null || y === null)
      return x === y ? byName(a, b) : x === null ? 1 : -1;
    return sign * (x - y) || byName(a, b);
  });
}

function RateCell({
  rate,
  previous,
  digits,
}: {
  rate: number;
  previous: number | null;
  digits: number;
}) {
  return (
    <td className="px-2 py-2 text-right align-middle tabular-nums sm:px-3">
      <span className="block">{formatPercent(rate, digits)}</span>
      {previous !== null ? (
        <RateDelta
          delta={rate - previous}
          digits={digits}
          className="text-xs"
        />
      ) : null}
    </td>
  );
}

const pickPrevious = (row: MetaRow, key: keyof Rates) =>
  row.previous?.[key] ?? null;

/** Every hero's rates in one rank and period, sortable, with the change from the period before. */
export function StatisticsView({
  heroes,
  initial,
}: {
  heroes: HeroSummary[];
  initial: MetaSnapshot;
}) {
  const { state, params, setParams } = useMetaFilters();
  const { data, loading, error } = useMetaSnapshot(
    initial,
    state.bracket,
    state.period,
  );
  const query = params.get("q") ?? "";
  const sortParam = params.get("sort");
  const sort: SortKey =
    sortParam && Object.hasOwn(SORTS, sortParam)
      ? (sortParam as SortKey)
      : "tier";
  const dir: Dir =
    params.get("dir") === "asc" || params.get("dir") === "desc"
      ? (params.get("dir") as Dir)
      : SORTS[sort].firstDir;

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const rows = useMemo(() => {
    const key = searchKey(query);
    const shown = data.rows.flatMap((row): Row[] => {
      const hero = byId.get(row.id);
      if (!hero) return [];
      if (state.role !== "all" && !hero.roles.includes(state.role)) return [];
      if (state.lane !== "all" && !hero.lanes.includes(state.lane)) return [];
      if (key && !searchKey(hero.name).includes(key)) return [];
      return [{ ...row, hero }];
    });
    return sortRows(shown, sort, dir);
  }, [data, byId, state.role, state.lane, query, sort, dir]);

  const setSort = (key: SortKey) => {
    const nextDir: Dir =
      key === sort ? (dir === "asc" ? "desc" : "asc") : SORTS[key].firstDir;
    setParams({
      sort: key === "tier" ? null : key,
      dir: nextDir === SORTS[key].firstDir ? null : nextDir,
    });
  };

  const header = (key: SortKey, className?: string) => {
    const active = key === sort;
    const Icon = dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <th
        scope="col"
        aria-sort={
          active ? (dir === "asc" ? "ascending" : "descending") : "none"
        }
        className={cn("px-2 py-2 font-medium sm:px-3", className)}
      >
        <button
          type="button"
          onClick={() => setSort(key)}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            active && "text-foreground",
          )}
        >
          <span className="sm:hidden">{SORTS[key].short}</span>
          <span className="hidden sm:inline">{SORTS[key].label}</span>
          {active ? (
            <Icon className="size-3" weight="bold" aria-hidden />
          ) : null}
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label className="relative block sm:max-w-sm">
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
        <MetaFilters state={state} setParams={setParams} />
      </div>
      <SnapshotNote data={data} loading={loading} error={error} />

      {rows.length > 0 ? (
        <div
          aria-busy={loading}
          className={cn(
            "overflow-x-auto rounded-lg border bg-surface transition-opacity",
            loading && "opacity-60",
          )}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">
              Hero statistics. Select a column header to sort.
            </caption>
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className="hidden w-10 px-3 py-2 text-right font-medium sm:table-cell"
                >
                  #
                </th>
                {header("name", "text-left")}
                {header("tier", "hidden text-left sm:table-cell")}
                {header("win", "text-right")}
                {header("pick", "text-right")}
                {header("ban", "text-right")}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="hidden px-3 py-2 text-right align-middle text-muted-foreground tabular-nums sm:table-cell">
                    {index + 1}
                  </td>
                  <th
                    scope="row"
                    className="px-2 py-2 text-left font-medium sm:px-3"
                  >
                    <Link
                      href={`/heroes/${row.hero.slug}`}
                      className="flex items-center gap-2 hover:text-ally-text"
                    >
                      <HeroAvatar
                        name={row.hero.name}
                        src={row.hero.head_image_url}
                        size="xs"
                        decorative
                      />
                      <span className="truncate">{row.hero.name}</span>
                      {row.tier ? (
                        <TierBadge
                          tier={row.tier}
                          size="sm"
                          className="sm:hidden"
                        />
                      ) : null}
                    </Link>
                  </th>
                  <td className="hidden px-3 py-2 align-middle sm:table-cell">
                    {row.tier ? (
                      <TierBadge tier={row.tier} size="sm" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Rarely picked
                      </span>
                    )}
                  </td>
                  <RateCell
                    rate={row.winRate}
                    previous={pickPrevious(row, "winRate")}
                    digits={1}
                  />
                  <RateCell
                    rate={row.pickRate}
                    previous={pickPrevious(row, "pickRate")}
                    digits={2}
                  />
                  <RateCell
                    rate={row.banRate}
                    previous={pickPrevious(row, "banRate")}
                    digits={1}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed bg-surface/60 p-6 text-sm text-muted-foreground">
          No hero matches these filters.
        </p>
      )}
    </div>
  );
}
