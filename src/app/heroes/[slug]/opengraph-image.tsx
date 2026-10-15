import { ImageResponse } from "next/og";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { getHeroes, getRankedHeroes } from "@/lib/data";
import { formatPercent } from "@/lib/format";
import {
  imageDataUrl,
  OG_SIZE,
  OgFrame,
  ogColors,
  ogFonts,
  ogTierColors,
} from "@/lib/og";
import { bracketLabels, laneLabels, roleLabels } from "@/types/domain";

export const alt = "Hero card with role, lane, tier and win rate";
export const size = OG_SIZE;
export const contentType = "image/png";

// One image per hero, built with the site like the hero pages.
export async function generateStaticParams() {
  const heroes = await getHeroes();
  if (heroes.length === 0) return [{ slug: "no-heroes-yet" }];
  return heroes.map((hero) => ({ slug: hero.slug }));
}

function initials(name: string) {
  const parts = name.split(/[\s.'-]+/).filter(Boolean);
  return (
    parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2)
  ).toUpperCase();
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { heroes } = await getRankedHeroes(DEFAULT_BRACKET, DEFAULT_PERIOD);
  const hero = heroes.find((h) => h.slug === slug);
  const [fonts, portrait] = await Promise.all([
    ogFonts(),
    imageDataUrl(hero?.head_image_url ?? null),
  ]);

  if (!hero) {
    return new ImageResponse(
      <OgFrame>
        <span style={{ fontSize: 72, fontWeight: 700 }}>Hero not found</span>
      </OgFrame>,
      { ...size, fonts },
    );
  }

  const roles = hero.roles.map((r) => roleLabels[r]).join(" and ");
  const lanes = hero.lanes.map((l) => laneLabels[l]).join(", ");
  return new ImageResponse(
    <OgFrame>
      <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 260,
            height: 260,
            border: `6px solid ${ogColors.ally}`,
            borderRadius: 14,
            background: "#1f3541",
            overflow: "hidden",
          }}
        >
          {portrait ? (
            <img src={portrait} width={248} height={248} alt="" />
          ) : (
            <span
              style={{ fontSize: 96, fontWeight: 700, color: ogColors.muted }}
            >
              {initials(hero.name)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1 }}>
            {hero.name}
          </span>
          <span
            style={{ fontSize: 34, fontWeight: 600, color: ogColors.muted }}
          >
            {lanes ? `${roles}, ${lanes}` : roles}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginTop: 10,
            }}
          >
            {hero.tier ? (
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: ogTierColors[hero.tier][1],
                  background: ogTierColors[hero.tier][0],
                  borderRadius: 8,
                  padding: "4px 16px",
                }}
              >
                {`Tier ${hero.tier}`}
              </span>
            ) : null}
            <span style={{ fontSize: 34, fontWeight: 600 }}>
              {`Win rate ${formatPercent(hero.winRate)} in ${bracketLabels[DEFAULT_BRACKET]}`}
            </span>
          </div>
        </div>
      </div>
    </OgFrame>,
    { ...size, fonts },
  );
}
