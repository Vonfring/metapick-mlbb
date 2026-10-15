import { describe, expect, it } from "vitest";
import type { EmblemRow, EmblemTalentRow, ItemRow } from "@/types/data";
import { setForRole, toTalentViews } from "./emblems";
import { compareItems, inCategory, toItemViews } from "./items";
import { splitCooldown, splitSummary } from "./text";

const item = (
  over: Partial<ItemRow> & Pick<ItemRow, "id" | "name">,
): ItemRow => ({
  slug: over.name.toLowerCase().replace(/\W+/g, "-"),
  category: "attack",
  other_categories: [],
  tier: 1,
  price: 100,
  attributes: [],
  passives: [],
  builds_into: [],
  icon_url: null,
  ...over,
});

describe("items", () => {
  const dagger = item({
    id: 1,
    name: "Dagger",
    price: 250,
    builds_into: [3, 4],
  });
  const javelin = item({
    id: 2,
    name: "Javelin",
    price: 320,
    builds_into: [3],
  });
  const fury = item({
    id: 3,
    name: "Berserker's Fury",
    tier: 3,
    price: 2390,
    attributes: [{ label: "Crit Chance", value: "+25%" }],
    passives: [
      {
        name: "Doom",
        description: "Critical strikes grant extra Physical Attack.",
      },
    ],
  });
  const despair = item({
    id: 4,
    name: "Blade of Despair",
    tier: 3,
    price: 3010,
  });
  const potion = item({ id: 5, name: "Power Potion", tier: null, price: 1500 });
  const gloves = item({
    id: 6,
    name: "Expert Gloves",
    other_categories: ["magic"],
  });

  it("puts final items first, then the pricier one, and untiered items last", () => {
    const sorted = [dagger, potion, fury, javelin, despair]
      .sort(compareItems)
      .map((i) => i.name);
    expect(sorted).toEqual([
      "Blade of Despair",
      "Berserker's Fury",
      "Javelin",
      "Dagger",
      "Power Potion",
    ]);
  });

  it("resolves the build path to names in both directions", () => {
    const views = new Map(
      toItemViews([dagger, javelin, fury, despair]).map((v) => [v.name, v]),
    );
    expect(views.get("Berserker's Fury")!.builtFrom).toEqual([
      "Dagger",
      "Javelin",
    ]);
    expect(views.get("Dagger")!.buildsInto).toEqual([
      "Berserker's Fury",
      "Blade of Despair",
    ]);
    expect(views.get("Blade of Despair")!.buildsInto).toEqual([]);
  });

  it("searches names, stats and passives", () => {
    const [view] = toItemViews([fury]);
    expect(view!.searchText).toContain("critchance");
    expect(view!.searchText).toContain("doom");
    expect(view!.searchText).toContain("berserkersfury");
  });

  it("counts an item in each shop tab that lists it", () => {
    expect(inCategory(gloves, "attack")).toBe(true);
    expect(inCategory(gloves, "magic")).toBe(true);
    expect(inCategory(gloves, "defense")).toBe(false);
  });
});

describe("description text", () => {
  it("splits a trailing cooldown line off", () => {
    expect(splitCooldown("Gain a shield for 5s\nCooldown: 75s")).toEqual({
      text: "Gain a shield for 5s",
      cooldown: "75",
    });
    expect(splitCooldown("Recovers 5% Max HP.\nCooldown: 6s.")).toEqual({
      text: "Recovers 5% Max HP.",
      cooldown: "6",
    });
  });

  it("keeps cooldowns that carry extra conditions in the text", () => {
    const text =
      "Slows enemies.\nCooldown: 10s (each Basic Attack reduces it by 1s, down to 3s).";
    expect(splitCooldown(text)).toEqual({ text, cooldown: null });
  });

  it("splits the opening summary line", () => {
    expect(
      splitSummary("HP-Based AOE Damage\nDeal magic damage nearby"),
    ).toEqual({
      summary: "HP-Based AOE Damage",
      text: "Deal magic damage nearby",
    });
    expect(splitSummary("Gain 16 Adaptive Attack")).toEqual({
      summary: null,
      text: "Gain 16 Adaptive Attack",
    });
  });
});

describe("emblems", () => {
  const set = (
    id: number,
    name: string,
    roles: EmblemRow["recommended_roles"],
  ): EmblemRow => ({
    id,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    attributes: [],
    icon_url: null,
    recommended_roles: roles,
    sort_order: id,
  });
  const talent = (
    id: number,
    emblemId: number | null,
    tier: number,
    description: string,
  ): EmblemTalentRow => ({
    id,
    emblem_id: emblemId,
    name: `Talent ${id}`,
    tier,
    description,
    icon_url: null,
    sort_order: id,
  });
  const sets = [
    set(1, "Basic Common", []),
    set(2, "Tank", ["tank"]),
    set(3, "Mage", ["mage"]),
  ];

  it("marks the shared set's talents as open to every set", () => {
    const views = toTalentViews(sets, [
      talent(
        12,
        2,
        3,
        "HP-Based AOE Damage\nDeal damage nearby\nCooldown: 15s",
      ),
      talent(11, 1, 1, "Gain 16 Adaptive Attack"),
    ]);
    expect(views.map((v) => v.id)).toEqual([11, 12]);
    expect(views[0]).toMatchObject({
      setId: null,
      setName: null,
      summary: null,
      cooldown: null,
    });
    expect(views[1]).toMatchObject({
      setId: 2,
      setName: "Tank",
      summary: "HP-Based AOE Damage",
      text: "Deal damage nearby",
      cooldown: "15",
    });
  });

  it("finds the set made for a role", () => {
    expect(setForRole(sets, "mage")?.name).toBe("Mage");
    expect(setForRole(sets, "marksman")).toBeUndefined();
  });
});
