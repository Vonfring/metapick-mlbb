"use client";

import { useMemo } from "react";
import type { HeroSummary, MetaSnapshot } from "@/lib/data";
import { cn } from "@/lib/utils";
import { MetaFilters, useMetaFilters } from "./meta-filters";
import { SnapshotNote } from "./snapshot-note";
import { TierBoard } from "./tier-board";
import { useMetaSnapshot } from "./use-meta-snapshot";

/** The tier list with rank, period, role and lane filters. */
export function TierListView({
  heroes,
  initial,
}: {
  heroes: HeroSummary[];
  initial: MetaSnapshot;
}) {
  const { state, setParams } = useMetaFilters();
  const { data, loading, error } = useMetaSnapshot(
    initial,
    state.bracket,
    state.period,
  );
  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  // Tiers come from every hero in the rank and period; the filters only hide some.
  const rows = data.rows.filter((row) => {
    const hero = byId.get(row.id);
    return (
      hero !== undefined &&
      (state.role === "all" || hero.roles.includes(state.role)) &&
      (state.lane === "all" || hero.lanes.includes(state.lane))
    );
  });

  return (
    <div className="flex flex-col gap-5">
      <MetaFilters state={state} setParams={setParams} />
      <SnapshotNote data={data} loading={loading} error={error} />
      <div
        aria-busy={loading}
        className={cn("transition-opacity", loading && "opacity-60")}
      >
        {rows.length > 0 ? (
          <TierBoard heroes={byId} rows={rows} />
        ) : (
          <p className="rounded-lg border border-dashed bg-surface/60 p-6 text-sm text-muted-foreground">
            No hero matches these filters.
          </p>
        )}
      </div>
    </div>
  );
}
