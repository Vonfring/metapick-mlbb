import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SourceEnvelope } from "../client";
import { extractRecords } from "../records";
import { parseCooldownAndCost, parseHeroRecord } from "./heroes";
import { checkStatsSanity, parseStatsRecords } from "./stats";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(path.join(__dirname, "..", "__fixtures__", name), "utf8"),
  ) as SourceEnvelope;

describe("parseHeroRecord", () => {
  const { records } = extractRecords(fixture("hero-records.json"));
  const [hirara, miya, yss] = records.map(parseHeroRecord);

  it("maps roles and lanes by their official IDs", () => {
    expect(miya!.hero).toMatchObject({
      id: 1,
      slug: "miya",
      name: "Miya",
      roles: ["marksman"],
      lanes: ["gold"],
    });
    expect(yss!.hero).toMatchObject({
      id: 30,
      slug: "yi-sun-shin",
      roles: ["assassin", "marksman"],
      lanes: ["jungle"],
    });
    expect(hirara!.hero).toMatchObject({
      id: 133,
      roles: ["assassin"],
      lanes: ["jungle"],
    });
  });

  it("reads ratings, specialties, lore and images", () => {
    expect(miya!.hero).toMatchObject({
      durability: 10,
      offense: 70,
      control_effect: 40,
      difficulty: 10,
    });
    expect(miya!.hero.specialties).toEqual(["Finisher", "Damage"]);
    expect(miya!.hero.head_image_url).toMatch(
      /^https:\/\/akmweb\.youngjoygame\.com\//,
    );
    expect(hirara!.hero.lore).toContain("geisha ninja");
  });

  it("keeps each skill once, in order, with plain text and parsed costs", () => {
    expect(
      miya!.skills.map((s) => [s.slot, s.name, s.cooldown, s.cost]),
    ).toEqual([
      [0, "Moon Blessing", null, null],
      [1, "Moon Arrow", "11", "60 mana"],
      [2, "Arrow of Eclipse", "8", "90 mana"],
      [3, "Hidden Moonlight", "30", "120 mana"],
    ]);
    const skillIds = hirara!.skills.map((s) => s.source_skill_id);
    expect(new Set(skillIds).size).toBe(skillIds.length);
    expect(hirara!.skills.every((s) => !s.description.includes("<font"))).toBe(
      true,
    );
  });

  it("drops empty relation slots", () => {
    expect(yss!.relations.every((r) => r.target_hero_id > 0)).toBe(true);
    expect(yss!.relations.map((r) => r.relation)).toContain("weak_against");
  });
});

describe("parseCooldownAndCost", () => {
  it("handles missing parts and ranges", () => {
    expect(parseCooldownAndCost("")).toEqual({ cooldown: null, cost: null });
    expect(parseCooldownAndCost("CD: 12-9   Energy Cost: 20")).toEqual({
      cooldown: "12-9",
      cost: "20 energy",
    });
  });
});

describe("parseStatsRecords", () => {
  it("reads rates and turns both lists into pairs from the main hero's side", () => {
    const { records } = extractRecords(fixture("stats-counters.json"));
    const { stats, pairs, skipped } = parseStatsRecords(records);
    expect(skipped).toBe(0);
    expect(stats).toHaveLength(2);
    const masha = stats.find((s) => s.hero_id === 88)!;
    expect(masha).toEqual({
      hero_id: 88,
      win_rate: 0.601278,
      pick_rate: 0.00674,
      ban_rate: 0.414635,
    });
    const mashaPairs = pairs.filter((p) => p.hero_id === 88);
    expect(mashaPairs).toHaveLength(10);
    expect(mashaPairs.find((p) => p.other_id === 104)?.win_rate_delta).toBe(
      0.030836,
    );
    expect(mashaPairs.find((p) => p.other_id === 34)?.win_rate_delta).toBe(
      -0.02972,
    );
  });

  it("flags snapshots that do not add up", () => {
    const good = Array.from({ length: 100 }, (_, i) => ({
      hero_id: i + 1,
      win_rate: 0.5,
      pick_rate: 0.01,
      ban_rate: 0.05,
    }));
    expect(checkStatsSanity(good, 100).ok).toBe(true);
    expect(checkStatsSanity(good.slice(0, 50), 100).problems[0]).toMatch(
      /only 50/,
    );
    const skewed = good.map((s) => ({ ...s, win_rate: 0.7 }));
    expect(checkStatsSanity(skewed, 100).ok).toBe(false);
  });
});
