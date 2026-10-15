"use client";

import { useEffect, useState } from "react";
import type { MetaSnapshot } from "@/lib/data";
import type { PeriodDays, RankBracket } from "@/types/domain";

const loaded = new Map<string, Promise<MetaSnapshot>>();

function load(bracket: RankBracket, period: PeriodDays) {
  const key = `${bracket}/${period}`;
  let pending = loaded.get(key);
  if (!pending) {
    pending = fetch(`/data/v1/stats/${bracket}/${period}`).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<MetaSnapshot>;
    });
    // A failed load can be tried again.
    pending.catch(() => loaded.delete(key));
    loaded.set(key, pending);
  }
  return pending;
}

export type MetaSnapshotState = {
  /** The snapshot to show: the requested one, or the last one while it loads. */
  data: MetaSnapshot;
  loading: boolean;
  error: boolean;
};

/**
 * The statistics for a rank and period. The page carries the default one;
 * any other is fetched once from /data/v1/stats (static JSON) and kept.
 */
export function useMetaSnapshot(
  initial: MetaSnapshot,
  bracket: RankBracket,
  period: PeriodDays,
): MetaSnapshotState {
  const key = `${bracket}/${period}`;
  const isInitial = bracket === initial.bracket && period === initial.period;
  // The selection whose numbers are on screen. While another one loads, or
  // when it fails, these stay visible.
  const [shown, setShown] = useState({
    key: `${initial.bracket}/${initial.period}`,
    data: initial,
    error: false,
  });
  // Back to the default: it is on screen at once (adjusting state while
  // rendering, as React recommends for values derived from props).
  if (isInitial && shown.key !== key) {
    setShown({ key, data: initial, error: false });
  }

  useEffect(() => {
    if (isInitial) return;
    let current = true;
    load(bracket, period).then(
      (data) => current && setShown({ key, data, error: false }),
      () => current && setShown((prev) => ({ ...prev, key, error: true })),
    );
    return () => {
      current = false;
    };
  }, [bracket, period, isInitial, key]);

  if (isInitial) return { data: initial, loading: false, error: false };
  if (shown.key === key) {
    return { data: shown.data, loading: false, error: shown.error };
  }
  return { data: shown.data, loading: true, error: false };
}
