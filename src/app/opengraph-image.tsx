import { ImageResponse } from "next/og";
import { OG_SIZE, OgFrame, ogColors, ogFonts } from "@/lib/og";

export const alt =
  "Metapick MLBB: tier list, counter picks, matchups and a draft simulator for Mobile Legends";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgFrame>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <span
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          Who are you facing?
        </span>
        <span
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: ogColors.muted,
            maxWidth: 860,
            lineHeight: 1.3,
          }}
        >
          Tier list, counter picks, matchups and a ranked draft simulator for
          Mobile Legends, with the numbers behind every suggestion.
        </span>
      </div>
    </OgFrame>,
    { ...size, fonts: await ogFonts() },
  );
}
