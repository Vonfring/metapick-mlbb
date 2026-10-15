import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type * as React from "react";
import { siteConfig } from "@/config/site";
import type { Tier } from "@/types/domain";

// Shared pieces of the Open Graph images (app/opengraph-image.tsx and
// app/heroes/[slug]/opengraph-image.tsx). The images use the dark theme and
// the map diagonal: blue side bottom left, red side top right.

export const OG_SIZE = { width: 1200, height: 630 };

export const ogColors = {
  background: "#0e1a21",
  text: "#e4ecee",
  muted: "#93a7b0",
  border: "#284150",
  ally: "#5287f0",
  allyText: "#8db0ff",
  enemy: "#e2693d",
};

/** The dark theme's tier ramp (globals.css): background and text per tier. */
export const ogTierColors: Record<Tier, [string, string]> = {
  SS: ["#ffb49a", "#0e1a21"],
  S: ["#ff9069", "#0e1a21"],
  A: ["#f27142", "#0e1a21"],
  B: ["#db5d2c", "#0e1a21"],
  C: ["#bd4102", "#ffffff"],
  D: ["#9c3607", "#ffffff"],
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

/** Chakra Petch from assets/fonts (SIL Open Font License, see OFL-ChakraPetch.txt). */
export async function ogFonts(): Promise<OgFont[]> {
  const [bold, semibold] = await Promise.all([
    readFont("chakra-petch-latin-700-normal.woff"),
    readFont("chakra-petch-latin-600-normal.woff"),
  ]);
  return [
    { name: "Chakra Petch", data: bold, weight: 700, style: "normal" },
    { name: "Chakra Petch", data: semibold, weight: 600, style: "normal" },
  ];
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

export function OgLogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M4.5 2H22v17.5z" fill={ogColors.enemy} />
      <path d="M2 4.5 19.5 22H2z" fill={ogColors.ally} />
    </svg>
  );
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
          fill="rgba(82,135,240,0.16)"
        />
        <polygon
          points={`0,0 ${width},0 ${width},${height}`}
          fill="rgba(226,105,61,0.16)"
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
          <OgLogoMark size={64} />
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
