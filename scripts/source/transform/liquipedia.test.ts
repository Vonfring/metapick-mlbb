import { describe, expect, it } from "vitest";
import raw from "../__fixtures__/liquipedia-catalog.json";
import { hashedId, parseCatalog, type RawCatalog } from "./liquipedia";

// Trimmed real pages: 8 items (one removed), 3 battle spells (one no longer
// in the navbox), and the first two emblem sets of the emblem portal.
const catalog = parseCatalog(raw as RawCatalog);
const item = (name: string) => catalog.items.find((i) => i.name === name)!;

describe("parseCatalog: items", () => {
  it("keeps available items only and uses wiki page IDs", () => {
    expect(catalog.items.map((i) => i.name)).not.toContain("Bloodlust Axe");
    expect(catalog.items).toHaveLength(7);
    expect(item("Blade of Despair").id).toBe(
      (raw as RawCatalog).pages["Blade of Despair"]!.pageid,
    );
  });

  it("reads cost, tier, category and labeled attributes", () => {
    expect(item("Blade of Despair")).toMatchObject({
      slug: "blade-of-despair",
      category: "attack",
      other_categories: [],
      tier: 3,
      price: 3010,
      attributes: [
        { label: "Physical Attack", value: "+160" },
        { label: "Movement Speed", value: "+5%" },
      ],
    });
    expect(item("Winter Crown").other_categories).toEqual(["magic"]);
    expect(item("Conceal")).toMatchObject({
      category: "roam",
      tier: null,
      price: 0,
    });
  });

  it("turns the unique attribute into an attribute and drops its duplicate card", () => {
    const fury = item("Berserker's Fury");
    expect(fury.attributes).toContainEqual({
      label: "Critical Damage (unique)",
      value: "+40%",
    });
    expect(fury.passives.map((p) => p.name)).toEqual(["Doom"]);
  });

  it("takes passives from the Ability section only and marks actives", () => {
    expect(item("Warrior Boots").passives.map((p) => p.name)).toEqual([
      "Valor",
    ]);
    expect(item("Conceal").passives[0]!.name).toBe("Conceal (Active)");
    expect(item("Winter Crown").passives[0]!.name).toBe("Frozen (Active)");
  });

  it("links recipes to downloaded items by name", () => {
    expect(item("Legion Sword").builds_into).toContain(
      item("Blade of Despair").id,
    );
    expect(item("Boots").builds_into).toEqual([item("Warrior Boots").id]);
  });
});

describe("parseCatalog: battle spells", () => {
  it("keeps the spells in the navbox, in navbox order, with the cooldown", () => {
    expect(catalog.spells.map((s) => s.name)).toEqual(["Aegis", "Flicker"]);
    expect(catalog.spells[1]!.description).toMatch(/^Blink a fixed distance/);
    expect(catalog.spells[1]!.description).toMatch(/\nCooldown: 120s$/);
  });
});

describe("parseCatalog: emblems and talents", () => {
  it("reads each set's attributes with stable hashed IDs and role hints", () => {
    expect(catalog.emblems.map((e) => e.name)).toEqual([
      "Basic Common",
      "Tank",
    ]);
    const tank = catalog.emblems[1]!;
    expect(tank).toMatchObject({
      id: hashedId("emblem", "tank"),
      slug: "tank",
      recommended_roles: ["tank"],
      attributes: [
        { label: "HP", value: "+500" },
        { label: "Hybrid Defense", value: "+10" },
        { label: "HP Regen", value: "+4" },
      ],
    });
  });

  it("assigns tiers: attribute talents 1, effect talents 2, core talents 3", () => {
    const tiers = Object.fromEntries(
      catalog.talents.map((t) => [t.name, t.tier]),
    );
    expect(tiers).toMatchObject({
      Thrill: 1,
      Swift: 1,
      "Wilderness Blessing": 2,
      "Seasoned Hunter": 2,
      "Impure Rage": 3,
      Vitality: 1,
      Tenacity: 2,
      "Concussive Blast": 3,
    });
    const vitality = catalog.talents.find((t) => t.name === "Vitality")!;
    expect(vitality.emblem_id).toBe(hashedId("emblem", "tank"));
    expect(vitality.description).toBe("Gain 225 extra max HP.");
  });

  it("dates the catalog by the newest page it used and reports no warnings", () => {
    expect(catalog.revisedAt).toBe("2026-06-14T18:30:50Z");
    expect(catalog.warnings).toEqual([]);
  });
});
