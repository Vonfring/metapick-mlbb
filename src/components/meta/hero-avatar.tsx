"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const sizes = { xxs: 24, xs: 32, sm: 40, md: 56, lg: 80, xl: 112 } as const;

function initials(name: string) {
  const parts = name
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/**
 * Square hero portrait with the clipped corner. Falls back to initials when
 * there is no image or the source fails to load. Images are never optimized
 * by Vercel (see next.config.ts).
 *
 * - `fluid` fills the parent's width instead of a fixed size.
 * - `decorative` hides the image from assistive tech when the name is
 *   already written next to it.
 * - `preload` for the few portraits above the fold.
 */
export function HeroAvatar({
  name,
  src,
  size = "md",
  fluid = false,
  decorative = false,
  preload = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  fluid?: boolean;
  decorative?: boolean;
  preload?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const px = sizes[size];
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted clip-corner",
        fluid && "aspect-square w-full",
        className,
      )}
      style={{
        ...(fluid ? {} : { width: px, height: px }),
        ["--clip-size" as string]: `${Math.round(px / 6)}px`,
      }}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={decorative ? "" : name}
          width={px}
          height={px}
          preload={preload}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : name}
          aria-hidden={decorative || undefined}
          className={cn(
            "font-display font-bold text-muted-foreground",
            fluid && "text-xl",
          )}
          style={
            fluid
              ? undefined
              : { fontSize: Math.max(12, Math.round(px * 0.34)) }
          }
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
