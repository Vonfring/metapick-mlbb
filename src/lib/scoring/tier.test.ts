import { describe, expect, it } from "vitest";
import { TIER_SCORING } from "@/config/tier-scoring";
import type { HeroStatRow } from "@/types/data";
import { computeTiers } from "./tier";

const stat = (
  hero_id: number,
  win_rate: number,
  pick_rate: number,
  ban_rate: number,
): HeroStatRow => ({
  hero_id,
  win_rate,
  pick_rate,
  ban_rate,
});

describe("computeTiers", () => {
  it("returns nothing for an empty snapshot", () => {
    expect(computeTiers([]).size).toBe(0);
  });

  it("ranks the stronger hero higher when everything else is equal", () => {
    const tiers = computeTiers([
      stat(1, 0.56, 0.01, 0.2),
      stat(2, 0.5, 0.01, 0.2),
      stat(3, 0.44, 0.01, 0.2),
    ]);
    expect(tiers.get(1)!.score).toBeGreaterThan(tiers.get(2)!.score);
    expect(tiers.get(2)!.score).toBeGreaterThan(tiers.get(3)!.score);
    expect(tiers.get(1)!.tier).toBe("SS");
    expect(tiers.get(3)!.tier).toBe("D");
  });

  it("pulls the win rate of rarely picked heroes toward 50%", () => {
    const tiers = computeTiers([
      stat(1, 0.7, 0.0012, 0),
      stat(2, 0.56, 0.02, 0),
    ]);
    // 0.7 at 0.12% pick share: (0.7 × 0.0012 + 0.5 × 0.002) / 0.0032 = 0.575
    expect(tiers.get(1)!.adjustedWinRate).toBeCloseTo(0.575, 5);
    expect(tiers.get(2)!.adjustedWinRate).toBeGreaterThan(0.55);
  });

  it("splits a large field by percentile using the configured cutoffs", () => {
    const stats = Array.from({ length: 100 }, (_, i) =>
      stat(i + 1, 0.4 + i * 0.002, 0.01, 0.05),
    );
    const counts = new Map<string, number>();
    for (const result of computeTiers(stats).values()) {
      counts.set(
        String(result.tier),
        (counts.get(String(result.tier)) ?? 0) + 1,
      );
    }
    expect(Object.fromEntries(counts)).toEqual({
      SS: 5,
      S: 15,
      A: 25,
      B: 25,
      C: 20,
      D: 10,
    });
  });

  it("leaves rarely picked heroes without a tier", () => {
    const tiers = computeTiers([
      stat(1, 0.55, 0.02, 0.1),
      stat(2, 0.6, TIER_SCORING.minPickRate / 2, 0),
      stat(3, 0.48, 0.02, 0.01),
    ]);
    expect(tiers.get(2)).toMatchObject({ tier: null, percentile: null });
    expect(tiers.get(1)!.tier).toBe("SS");
  });
});
