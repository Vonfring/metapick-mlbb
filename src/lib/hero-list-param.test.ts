import { describe, expect, it } from "vitest";
import type { HeroSummary } from "@/lib/data";
import { heroListParam, parseHeroList } from "./hero-list-param";

const hero = (id: number, slug: string): HeroSummary => ({
  id,
  slug,
  name: slug,
  roles: ["fighter"],
  lanes: ["exp"],
  head_image_url: null,
});

const bySlug = new Map(
  [hero(1, "fanny"), hero(2, "ling"), hero(3, "chang-e")].map((h) => [
    h.slug,
    h,
  ]),
);

describe("parseHeroList", () => {
  it("keeps known slugs in order, once each, up to the limit", () => {
    expect(
      parseHeroList("ling,unknown,fanny,ling,chang-e", bySlug, 2).map(
        (h) => h.id,
      ),
    ).toEqual([2, 1]);
  });

  it("returns nothing for a missing or empty value", () => {
    expect(parseHeroList(null, bySlug, 5)).toEqual([]);
    expect(parseHeroList("", bySlug, 5)).toEqual([]);
  });

  it("round-trips through heroListParam", () => {
    const list = parseHeroList("chang-e,fanny", bySlug, 5);
    expect(heroListParam(list)).toBe("chang-e,fanny");
    expect(heroListParam([])).toBeNull();
  });
});
