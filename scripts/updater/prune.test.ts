import { describe, expect, it } from "vitest";
import {
  oldestKeptDate,
  snapshotsToDelete,
  snapshotsToStripPairs,
} from "./prune";

const snap = (
  id: number,
  date: string,
  published = true,
  bracket = "mythic",
  period = 7,
) => ({
  id,
  rank_bracket: bracket,
  period_days: period,
  snapshot_date: date,
  is_published: published,
});

describe("snapshotsToStripPairs", () => {
  it("keeps pairs for the newest published snapshot per rank and period only", () => {
    const ids = snapshotsToStripPairs([
      snap(1, "2026-10-13"),
      snap(2, "2026-10-14"),
      snap(3, "2026-10-15", false),
      snap(4, "2026-10-12", true, "glory"),
    ]);
    expect(ids).toEqual([1]);
  });

  it("strips nothing when no snapshot with pairs is published", () => {
    expect(snapshotsToStripPairs([snap(1, "2026-10-13", false)])).toEqual([]);
  });
});

describe("snapshotsToDelete", () => {
  it("deletes old snapshots but keeps the newest published one per rank and period", () => {
    const ids = snapshotsToDelete(
      [
        snap(1, "2026-01-01"),
        snap(2, "2026-01-02"),
        snap(3, "2026-01-03", false),
        snap(4, "2026-10-01", true, "glory"),
        snap(5, "2026-01-01", true, "glory"),
      ],
      "2026-06-17",
    );
    expect(ids.sort()).toEqual([1, 3, 5]);
  });
});

describe("oldestKeptDate", () => {
  it("counts back the retention window and refuses short ones", () => {
    expect(oldestKeptDate("2026-10-15", 120)).toBe("2026-06-17");
    expect(() => oldestKeptDate("2026-10-15", 7)).toThrow(/at least 30/);
  });
});
