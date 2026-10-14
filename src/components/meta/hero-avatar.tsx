"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

const sizes = { xs: 32, sm: 40, md: 56, lg: 80, xl: 112 } as const;

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
 */
export function HeroAvatar({
  name,
  src,
  size = "md",
  className,
  priority = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const px = sizes[size];
  const showImage = Boolean(src) && !failed;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted clip-corner",
        className,
      )}
      style={{
        width: px,
        height: px,
        ["--clip-size" as string]: `${Math.round(px / 6)}px`,
      }}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={name}
          width={px}
          height={px}
          priority={priority}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className="font-display font-bold text-muted-foreground"
          style={{ fontSize: Math.max(12, Math.round(px * 0.34)) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
