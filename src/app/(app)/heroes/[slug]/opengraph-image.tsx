import { ImageResponse } from "next/og";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { getHeroSlugParams, getRankedHeroes } from "@/lib/data";
import { formatPercent, initials } from "@/lib/format";
import { roleLine } from "@/lib/heroes/roles";
import {
  imageDataUrl,
  OG_SIZE,
  OgFrame,
  ogColors,
  ogFonts,
  ogTierColors,
} from "@/lib/og";
import { bracketLabels } from "@/types/domain";

export const alt = "Hero card with role, lane, tier and win rate";
export const size = OG_SIZE;
export const contentType = "image/png";

// One image per hero, built with the site like the hero pages.
export const generateStaticParams = getHeroSlugParams;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { heroes } = await getRankedHeroes(DEFAULT_BRACKET, DEFAULT_PERIOD);
  const hero = heroes.find((h) => h.slug === slug);
  // The hero page answers 404 for an unknown slug; so does its image.
  if (!hero) return new Response(null, { status: 404 });
  const [fonts, portrait] = await Promise.all([
    ogFonts(),
    imageDataUrl(hero.head_image_url),
  ]);

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
            background: ogColors.portrait,
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
            {roleLine(hero)}
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
                  ...ogTierColors[hero.tier],
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
