"use client";

import { useLayoutEffect } from "react";

/**
 * Adds the welcome page's motion once it is in the browser. The script
 * loads on demand, so the page itself ships as plain HTML and CSS. A layout
 * effect, so everything is undone before Next.js hides the page on
 * navigation (it keeps the page in the document) and redone on the way back.
 */
export function LandingMotion() {
  useLayoutEffect(() => {
    const root = document.getElementById("landing");
    if (!root) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("./motion").then(({ startLanding }) => {
      if (!cancelled) stop = startLanding(root);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
