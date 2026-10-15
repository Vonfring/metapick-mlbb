import { describe, expect, it } from "vitest";
import type { HeroStatRow } from "@/types/data";
import { buildMetaRows, daysBefore } from "./meta-rows";

const stat = (
  hero_id: number,
  win_rate: number,
  pick_rate = 0.01,
  ban_rate = 0.01,
): HeroStatRow => ({
  hero_id,
  win_rate,
  pick_rate,
  ban_rate,
});

describe("buildMetaRows", () => {
  const stats = Array.from({ length: 40 }, (_, i) =>
    stat(i + 1, 0.45 + i * 0.0025),
  );

  it("sorts the strongest first and attaches the previous period", () => {
    const rows = buildMetaRows(stats, [stat(40, 0.5, 0.02, 0.05)]);
    expect(rows[0]).toMatchObject({ id: 40, tier: "SS" });
    expect(rows[0]!.previous).toEqual({
      winRate: 0.5,
      pickRate: 0.02,
      banRate: 0.05,
    });
    expect(rows.find((r) => r.id === 1)!.previous).toBeNull();
  });

  it("gives rarely picked heroes no tier or score and lists them last", () => {
    const rows = buildMetaRows([...stats, stat(99, 0.7, 0.0001)], null);
    expect(rows.at(-1)).toMatchObject({ id: 99, tier: null, score: null });
  });
});

describe("daysBefore", () => {
  it("counts back across month ends in UTC", () => {
    expect(daysBefore("2026-10-03", 7)).toBe("2026-09-26");
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });
});
