"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * The draft's one animation: a hero that was just placed settles into its
 * slot. Plays only for the slot placed in this visit (not on a reload or a
 * shared link), and not at all when the visitor prefers reduced motion.
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
  useGSAP(
    () => {
      if (!play || !ref.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(ref.current, {
          scale: 1.35,
          opacity: 0,
          y: -8,
          duration: 0.42,
          ease: "back.out(2.4)",
          clearProps: "transform,opacity",
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [play] },
  );
  return (
    <span ref={ref} className={cn("block", className)}>
      {children}
    </span>
  );
}
