import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type * as React from "react";
import { LOGO_PATHS } from "@/components/brand/logo-mark";
import { siteConfig } from "@/config/site";
import type { Tier } from "@/types/domain";

// Shared pieces of the Open Graph images (app/opengraph-image.tsx and
// app/heroes/[slug]/opengraph-image.tsx). The images use the dark theme and
// the map diagonal: blue side bottom left, red side top right.

export const OG_SIZE = { width: 1200, height: 630 };

/** Dark theme colors from globals.css; the images cannot read CSS variables. */
export const ogColors = {
  background: siteConfig.themeColors.dark,
  text: "#e4ecee",
  muted: "#93a7b0",
  border: "#284150",
  portrait: "#1f3541",
  ally: "#5287f0",
  allySoft: "rgba(82,135,240,0.16)",
  enemy: "#e2693d",
  enemySoft: "rgba(226,105,61,0.16)",
};

/** The dark theme's tier ramp (globals.css), ready to spread into a style. */
export const ogTierColors: Record<Tier, { background: string; color: string }> =
  {
    SS: { background: "#ffb49a", color: ogColors.background },
    S: { background: "#ff9069", color: ogColors.background },
    A: { background: "#f27142", color: ogColors.background },
    B: { background: "#db5d2c", color: ogColors.background },
    C: { background: "#bd4102", color: "#ffffff" },
    D: { background: "#9c3607", color: "#ffffff" },
  };

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 600 | 700;
  style: "normal";
};

async function readFont(file: string): Promise<ArrayBuffer> {
  // Cached, so the images stay static: uncached file reads would make them
  // render on every request.
  "use cache";
  cacheLife("max");
  const bytes = await readFile(path.join(process.cwd(), "assets/fonts", file));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

// Kept once loaded: the renderer caches parsed fonts per buffer object, so
// handing every image the same buffers saves parsing them again.
let loadedFonts: OgFont[] | undefined;

/** Chakra Petch from assets/fonts (SIL Open Font License, see OFL-ChakraPetch.txt). */
export async function ogFonts(): Promise<OgFont[]> {
  if (loadedFonts) return loadedFonts;
  const [bold, semibold] = await Promise.all([
    readFont("chakra-petch-latin-700-normal.woff"),
    readFont("chakra-petch-latin-600-normal.woff"),
  ]);
  loadedFonts = [
    { name: "Chakra Petch", data: bold, weight: 700, style: "normal" },
    { name: "Chakra Petch", data: semibold, weight: 600, style: "normal" },
  ];
  return loadedFonts;
}

/**
 * A remote PNG or JPEG as a data URL, or null when it cannot be loaded in a
 * few seconds. Hero portraits come from the official CDN; without one the
 * image shows the hero's initials instead.
 */
export async function imageDataUrl(url: string | null): Promise<string | null> {
  "use cache";
  cacheLife("gameData");
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg)/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** The 1200 × 630 frame: diagonal background, wordmark and site address. */
export function OgFrame({ children }: { children: React.ReactNode }) {
  const { width, height } = OG_SIZE;
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        background: ogColors.background,
        color: ogColors.text,
        fontFamily: "Chakra Petch",
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <polygon
          points={`0,0 0,${height} ${width},${height}`}
          fill={ogColors.allySoft}
        />
        <polygon
          points={`0,0 ${width},0 ${width},${height}`}
          fill={ogColors.enemySoft}
        />
        <line
          x1={0}
          y1={0}
          x2={width}
          y2={height}
          stroke={ogColors.border}
          strokeWidth={3}
        />
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={64} height={64} viewBox="0 0 24 24">
            <path d={LOGO_PATHS.enemy} fill={ogColors.enemy} />
            <path d={LOGO_PATHS.ally} fill={ogColors.ally} />
          </svg>
          <span style={{ fontSize: 48, fontWeight: 700 }}>
            {siteConfig.wordmark}
          </span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: ogColors.muted,
              border: `2px solid ${ogColors.border}`,
              borderRadius: 8,
              padding: "4px 10px",
            }}
          >
            {siteConfig.label}
          </span>
        </div>
        {children}
        <span style={{ fontSize: 26, fontWeight: 600, color: ogColors.muted }}>
          {new URL(siteConfig.url).host}
        </span>
      </div>
    </div>
  );
}
