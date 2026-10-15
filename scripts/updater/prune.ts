/** Retention rules for statistics (docs/activity-updater.md). */

import { daysBefore } from "@/lib/meta/meta-rows";

export type SnapshotWithPairs = {
  id: number;
  rank_bracket: string;
  period_days: number;
  snapshot_date: string;
  is_published: boolean;
};

/**
 * Snapshots whose matchup and teammate pairs can go: every snapshot with
 * pairs older than the newest published one with pairs for the same rank and
 * period. Newer snapshots (even hidden ones) keep theirs.
 */
export function snapshotsToStripPairs(
  snapshots: SnapshotWithPairs[],
): number[] {
  const keepDate = new Map<string, string>();
  for (const s of snapshots) {
    if (!s.is_published) continue;
    const key = `${s.rank_bracket}/${s.period_days}`;
    const kept = keepDate.get(key);
    if (!kept || s.snapshot_date > kept) keepDate.set(key, s.snapshot_date);
  }
  return snapshots
    .filter((s) => {
      const kept = keepDate.get(`${s.rank_bracket}/${s.period_days}`);
      return kept !== undefined && s.snapshot_date < kept;
    })
    .map((s) => s.id);
}

/** The first snapshot date kept when history is kept for `keepDays` days. */
export function oldestKeptDate(today: string, keepDays: number): string {
  if (keepDays < 30)
    throw new Error(`keepDays must be at least 30, got ${keepDays}`);
  return daysBefore(today, keepDays);
}

/**
 * Snapshots older than `cutoff` (YYYY-MM-DD), except the newest published one
 * per rank and period: the site keeps showing that one, with a note that it
 * is old, rather than losing the rank's numbers altogether.
 */
export function snapshotsToDelete(
  snapshots: SnapshotWithPairs[],
  cutoff: string,
): number[] {
  const newest = new Map<string, SnapshotWithPairs>();
  for (const s of snapshots) {
    if (!s.is_published) continue;
    const key = `${s.rank_bracket}/${s.period_days}`;
    const kept = newest.get(key);
    if (!kept || s.snapshot_date > kept.snapshot_date) newest.set(key, s);
  }
  const keep = new Set([...newest.values()].map((s) => s.id));
  return snapshots
    .filter((s) => s.snapshot_date < cutoff && !keep.has(s.id))
    .map((s) => s.id);
}
