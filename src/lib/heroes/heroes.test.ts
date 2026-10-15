import { describe, expect, it } from "vitest";
import type { HeroSkillRow, PairRow } from "@/types/data";
import { bestTeammates, counteredBy, strongAgainst } from "./pairings";
import { displaySkills } from "./skills";

const pair = (
  hero_id: number,
  other_id: number,
  win_rate_delta: number,
): PairRow => ({
  hero_id,
  other_id,
  win_rate_delta,
});

const rows = [
  pair(1, 2, 0.03),
  pair(1, 3, 0.05),
  pair(1, 4, -0.02),
  pair(1, 5, -0.06),
  pair(1, 1, 0.09),
  pair(7, 1, 0.08),
];

describe("pairings", () => {
  it("lists the opponents a hero beats, best first, from its own rows only", () => {
    expect(strongAgainst(1, rows)).toEqual([
      { heroId: 3, delta: 0.05 },
      { heroId: 2, delta: 0.03 },
    ]);
  });

  it("lists the opponents that beat a hero, strongest counter first", () => {
    expect(counteredBy(1, rows)).toEqual([
      { heroId: 5, delta: -0.06 },
      { heroId: 4, delta: -0.02 },
    ]);
    expect(counteredBy(1, rows, 1)).toHaveLength(1);
  });

  it("lists teammates that raise the win rate", () => {
    expect(bestTeammates(7, rows)).toEqual([{ heroId: 1, delta: 0.08 }]);
  });
});

const skill = (
  slot: number,
  name: string,
  description = `${name} text`,
): HeroSkillRow => ({
  hero_id: 105,
  slot,
  source_skill_id: null,
  name,
  description,
  cooldown: null,
  cost: null,
  tags: [],
  icon_url: null,
});

describe("displaySkills", () => {
  it("sorts by slot and drops repeats of the same skill across forms", () => {
    const shown = displaySkills([
      skill(2, "Tactical Reposition"),
      skill(0, "Mechanical Genius"),
      skill(5, "Mechanical Genius"),
      skill(1, "Masterful Gunner"),
      skill(6, "Tactical Reposition", "A different version"),
    ]);
    expect(shown.map((s) => `${s.slot}:${s.name}`)).toEqual([
      "0:Mechanical Genius",
      "1:Masterful Gunner",
      "2:Tactical Reposition",
      "6:Tactical Reposition",
    ]);
  });
});
