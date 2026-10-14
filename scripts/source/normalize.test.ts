import { describe, expect, it } from "vitest";
import { contentHash, pick, slugify, stripMarkup, toDelta, toRate } from "./normalize";

describe("slugify", () => {
  it.each([
    ["Yi Sun-shin", "yi-sun-shin"],
    ["Chang'e", "chang-e"],
    ["X.Borg", "x-borg"],
    ["Popol and Kupa", "popol-and-kupa"],
    ["Lapu-Lapu", "lapu-lapu"],
    ["  Luo Yi ", "luo-yi"],
    ["Blade of Despair", "blade-of-despair"],
  ])("%s -> %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});

describe("stripMarkup", () => {
  it("removes tags and color codes but keeps line breaks", () => {
    expect(stripMarkup('Deals <font color="#ff0000">200</font> damage.<br>Slows by 30%.')).toBe(
      "Deals 200 damage.\nSlows by 30%.",
    );
    expect(stripMarkup("[ffcc00]Passive[-]: gains &amp; keeps")).toBe("Passive: gains & keeps");
    expect(stripMarkup(null)).toBe("");
  });
});

describe("rates", () => {
  it("accepts fractions, percentages and strings", () => {
    expect(toRate(0.5123)).toBe(0.5123);
    expect(toRate(51.23)).toBe(0.5123);
    expect(toRate("51.23%")).toBe(0.5123);
    expect(toRate("n/a")).toBeNull();
    expect(toRate(250)).toBeNull();
  });

  it("keeps the sign of deltas", () => {
    expect(toDelta(-0.021)).toBe(-0.021);
    expect(toDelta("-2.1")).toBe(-0.021);
  });
});

describe("contentHash and pick", () => {
  it("ignores key order", () => {
    expect(contentHash({ a: 1, b: [2, 3] })).toBe(contentHash({ b: [2, 3], a: 1 }));
  });

  it("reads dotted paths", () => {
    expect(pick({ hero: { data: { name: "Miya" } } }, "hero.data.name")).toBe("Miya");
    expect(pick({ hero: null }, "hero.data.name")).toBeUndefined();
  });
});
