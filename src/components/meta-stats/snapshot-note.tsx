"use client";

import { useSyncExternalStore } from "react";
import { InfoIcon } from "@/components/icons";
import type { MetaSnapshot } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { bracketLabels, periodLabels } from "@/types/domain";

/** Statistics older than this get a note that the update may be late. */
const STALE_AFTER_HOURS = 48;

// Read once in the browser. The server and the prerendered HTML show no
// staleness note, since they cannot know when the page is read.
const openedAt = typeof window === "undefined" ? null : Date.now();
const subscribe = () => () => {};

/** Which numbers are shown, when they were updated, and what the changes compare with. */
export function SnapshotNote({
  data,
  loading,
  error,
}: {
  data: MetaSnapshot;
  loading: boolean;
  error: boolean;
}) {
  const now = useSyncExternalStore(
    subscribe,
    () => openedAt,
    () => null,
  );
  const { snapshot, previous } = data;
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        No statistics for {bracketLabels[data.bracket]},{" "}
        {periodLabels[data.period].toLowerCase()} yet.
      </p>
    );
  }
  // The updater only writes numbers that changed, so the last check can be
  // newer than the snapshot itself.
  const checked = data.checkedAt ?? snapshot.fetched_at;
  const unchangedSince =
    formatDate(snapshot.fetched_at) !== formatDate(checked)
      ? ` (numbers unchanged since ${formatDate(snapshot.fetched_at)})`
      : "";
  const ageHours = now === null ? 0 : (now - Date.parse(checked)) / 3_600_000;
  return (
    <div
      className="flex flex-col gap-1 text-sm text-muted-foreground"
      aria-live="polite"
    >
      <p>
        {bracketLabels[snapshot.rank_bracket]},{" "}
        {periodLabels[snapshot.period_days].toLowerCase()}. Updated{" "}
        {formatDate(checked)}
        {unchangedSince}.{" "}
        {previous
          ? `Changes compare with ${formatDate(previous.snapshot_date)}.`
          : `Changes appear once there are numbers from ${snapshot.period_days === 1 ? "the day" : `${snapshot.period_days} days`} before.`}
        {loading ? " Loading…" : ""}
      </p>
      {error ? (
        <p className="text-negative">
          The numbers you picked could not be loaded, so these stay on screen.
        </p>
      ) : null}
      {ageHours > STALE_AFTER_HOURS ? (
        <p className="flex items-center gap-1.5">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          No update for {Math.floor(ageHours / 24)} days. The next one may be
          late.
        </p>
      ) : null}
    </div>
  );
}
