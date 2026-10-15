"use client";

import { useEffect, useState } from "react";

const loaded = new Map<string, Promise<unknown>>();

/** One static JSON file from /data/v1, fetched once per page load. */
export function loadStaticJson<T>(url: string): Promise<T> {
  let pending = loaded.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<T>;
    });
    // A failed load can be tried again.
    pending.catch(() => loaded.delete(url));
    loaded.set(url, pending);
  }
  return pending;
}

export type StaticJsonState<T> = {
  /** The data to show: the requested file, or the last one while it loads. */
  data: T;
  loading: boolean;
  error: boolean;
};

/**
 * Data for a filter choice. The page carries the default choice as
 * `initial` (from `initialUrl`); any other file is fetched once and kept.
 */
export function useStaticJson<T>(
  initial: T,
  initialUrl: string,
  url: string,
): StaticJsonState<T> {
  const isInitial = url === initialUrl;
  // The file whose data is on screen. While another one loads, or when it
  // fails, this one stays visible.
  const [shown, setShown] = useState({
    url: initialUrl,
    data: initial,
    error: false,
  });
  // Back to the default: it is on screen at once (adjusting state while
  // rendering, as React recommends for values derived from props).
  if (isInitial && shown.url !== url) {
    setShown({ url, data: initial, error: false });
  }

  useEffect(() => {
    if (isInitial) return;
    let current = true;
    loadStaticJson<T>(url).then(
      (data) => current && setShown({ url, data, error: false }),
      () => current && setShown((prev) => ({ ...prev, url, error: true })),
    );
    return () => {
      current = false;
    };
  }, [url, isInitial]);

  if (isInitial) return { data: initial, loading: false, error: false };
  if (shown.url === url) {
    return { data: shown.data, loading: false, error: shown.error };
  }
  return { data: shown.data, loading: true, error: false };
}
