import { describe, expect, it } from "vitest";
import { cloudHeroes, landingTiers, type LandingHero } from "./landing";

const hero = (
  slug: string,
  tier: LandingHero["tier"],
  score: number | null,
  winRate: number | null = 0.5,
): LandingHero => ({ slug, name: slug.toUpperCase(), tier, score, winRate });

describe("landingTiers", () => {
  const heroes = [
    hero("a", "S", 1.2),
    hero("b", "SS", 2.5),
    hero("c", "S", 1.8),
    hero("d", "S", 1.5),
    hero("e", null, null),
    hero("f", "D", -2, null),
  ];

  it("orders tiers SS to D and heroes strongest first", () => {
    const tiers = landingTiers(heroes, 2);
    expect(tiers.map((t) => t.tier)).toEqual(["SS", "S"]);
    expect(tiers[1]!.heroes.map((h) => h.slug)).toEqual(["c", "d"]);
  });

  it("counts every hero in a tier, not only the listed ones", () => {
    expect(landingTiers(heroes, 2)[1]!.count).toBe(3);
  });

  it("leaves out heroes without a tier or a win rate", () => {
    const slugs = landingTiers(heroes, 9).flatMap((t) =>
      t.heroes.map((h) => h.slug),
    );
    expect(slugs).not.toContain("e");
    expect(slugs).not.toContain("f");
  });
});

describe("cloudHeroes", () => {
  it("takes the first heroes of each tier with their tier", () => {
    const tiers = landingTiers(
      [hero("a", "SS", 3), hero("b", "SS", 2), hero("c", "A", 1)],
      8,
    );
    expect(cloudHeroes(tiers, 1)).toEqual([
      { slug: "a", name: "A", tier: "SS" },
      { slug: "c", name: "C", tier: "A" },
    ]);
  });
});
