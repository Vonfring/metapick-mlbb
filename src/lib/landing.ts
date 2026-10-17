import { TIERS, type Tier } from "@/types/domain";

/** What the welcome page needs to know about a ranked hero. */
export type LandingHero = {
  slug: string;
  name: string;
  winRate: number | null;
  tier: Tier | null;
  /** Tier score, higher is stronger. Null for heroes without a tier. */
  score: number | null;
};

export type LandingTier = {
  tier: Tier;
  /** Every hero in the tier, not only the ones listed. */
  count: number;
  /** The strongest heroes of the tier, strongest first. */
  heroes: { slug: string; name: string; winRate: number }[];
};

/**
 * One card per tier, SS to D, listing the `perTier` strongest heroes (the
 * order of the tier list page). Tiers without heroes are left out.
 */
export function landingTiers(
  heroes: readonly LandingHero[],
  perTier: number,
): LandingTier[] {
  return TIERS.flatMap((tier) => {
    const inTier = heroes
      .filter(
        (h): h is LandingHero & { winRate: number; score: number } =>
          h.tier === tier && h.winRate !== null && h.score !== null,
      )
      .sort((a, b) => b.score - a.score);
    if (inTier.length === 0) return [];
    return [
      {
        tier,
        count: inTier.length,
        heroes: inTier
          .slice(0, perTier)
          .map(({ slug, name, winRate }) => ({ slug, name, winRate })),
      },
    ];
  });
}

/** The heroes that drift past the "Every hero" line: the first few of each tier. */
export function cloudHeroes(
  tiers: readonly LandingTier[],
  perTier: number,
): { slug: string; name: string; tier: Tier }[] {
  return tiers.flatMap(({ tier, heroes }) =>
    heroes.slice(0, perTier).map(({ slug, name }) => ({ slug, name, tier })),
  );
}
