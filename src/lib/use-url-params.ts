"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const EVENT = "metapick:urlparams";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * Filter state kept in the query string, so a filtered view can be shared.
 * Reads location.search on the client only: the server and the prerendered
 * HTML see no params, which keeps pages static. Updates replace the current
 * history entry instead of adding one per keystroke, and apply at once, so a
 * search box bound to the URL never lags behind typing.
 */
export function useUrlParams(): [
  URLSearchParams,
  (next: Record<string, string | null>) => void,
] {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const set = useCallback((next: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    // A null state lets the Next.js router pick up the new URL.
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [new URLSearchParams(search), set];
}

/**
 * Tells useUrlParams when a Next.js navigation changed the query string, for
 * example a link from /items?category=magic back to /items. Render it once,
 * inside <Suspense>: useSearchParams only resolves in the browser.
 */
export function UrlParamsSync() {
  const search = useSearchParams().toString();
  useEffect(() => {
    window.dispatchEvent(new Event(EVENT));
  }, [search]);
  return null;
}

/** A query value from a fixed list, or "all" when it is missing or unknown. */
export function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | "all" {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : "all";
}
