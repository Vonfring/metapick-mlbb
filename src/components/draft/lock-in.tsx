"use client";

import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** Starts loading GSAP early, so the first lock-in does not wait for it. */
export const preloadGsap = () => import("gsap");

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The draft's one animation: a hero that was just placed settles into its
 * slot. Plays only for the slot placed in this visit (not on a reload or a
 * shared link), and not at all when the visitor prefers reduced motion.
 * GSAP loads on demand, so no other page downloads it.
 */
export function LockIn({
  play,
  children,
  className,
}: {
  play: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // `play` only turns true after a click, so this runs in the browser.
  const [animate] = useState(() => play && !reducedMotion());

  useEffect(() => {
    const element = ref.current;
    if (!animate || !element) return;
    let cancelled = false;
    let revert: (() => void) | undefined;
    preloadGsap().then(
      ({ gsap }) => {
        if (cancelled) return;
        const tween = gsap.fromTo(
          element,
          { scale: 1.35, opacity: 0, y: -8 },
          {
            scale: 1,
            opacity: 1,
            y: 0,
            duration: 0.42,
            ease: "back.out(2.4)",
            clearProps: "transform,opacity",
          },
        );
        revert = () => tween.revert();
      },
      // Without GSAP the hero simply appears.
      () => {
        element.style.opacity = "";
      },
    );
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [animate]);

  return (
    <span
      ref={ref}
      className={cn("block", className)}
      // Hidden until the animation starts, so it does not flash in place first.
      style={animate ? { opacity: 0 } : undefined}
    >
      {children}
    </span>
  );
}
