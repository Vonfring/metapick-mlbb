import { describe, expect, it } from "vitest";
import type { PairEdge } from "./counter";
import { edgeLines } from "./explain";

const names: Record<number, string> = { 1: "Khufra", 2: "Fanny" };
const nameOf = (id: number) => names[id]!;

const edge = (overrides: Partial<PairEdge>): PairEdge => ({
  heroId: 1,
  opponentId: 2,
  statsDelta: null,
  statsFrom: null,
  notes: [],
  tagReasons: [],
  points: { stats: 0, notes: 0, tags: 0, total: 0 },
  hasData: false,
  ...overrides,
});

describe("edgeLines", () => {
  it("words statistics from the list they come from", () => {
    expect(
      edgeLines(
        edge({
          statsDelta: 0.031,
          statsFrom: "opponent",
          points: { stats: 3.1, notes: 0, tags: 0, total: 3.1 },
        }),
        nameOf,
      ),
    ).toEqual([
      { points: 3.1, text: "Fanny's win rate falls 3.1 points against Khufra" },
    ]);
    expect(
      edgeLines(
        edge({
          statsDelta: -0.02,
          statsFrom: "hero",
          points: { stats: -2, notes: 0, tags: 0, total: -2 },
        }),
        nameOf,
      )[0]!.text,
    ).toBe("Khufra's win rate falls 2.0 points against Fanny");
  });

  it("names the hero whose official page has the note", () => {
    const lines = edgeLines(
      edge({
        notes: [{ kind: "weak_against", by: "opponent", points: 1.5 }],
        points: { stats: 0, notes: 1.5, tags: 0, total: 1.5 },
      }),
      nameOf,
    );
    expect(lines[0]!.text).toBe("Official note: Fanny is weak against Khufra");
  });

  it("adds up small tag effects so the lines match the edge", () => {
    const lines = edgeLines(
      edge({
        tagReasons: [
          {
            rule: "lockdown",
            label: "Hard crowd control against a mobile hero",
            by: "hero",
            points: 1,
          },
        ],
        points: { stats: 0, notes: 0, tags: 1.27, total: 1.27 },
      }),
      nameOf,
    );
    expect(lines.map((l) => l.text)).toEqual([
      "Khufra: hard crowd control against a mobile hero",
      "Smaller tag effects",
    ]);
    expect(lines.reduce((s, l) => s + l.points, 0)).toBeCloseTo(1.27, 10);
  });
});
