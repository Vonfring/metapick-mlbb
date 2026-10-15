import type { HeroSummary } from "@/lib/data";

/** Heroes named in a query value ("fanny,ling"): known slugs only, no repeats, at most `max`. */
export function parseHeroList(
  value: string | null,
  bySlug: ReadonlyMap<string, HeroSummary>,
  max: number,
): HeroSummary[] {
  const heroes: HeroSummary[] = [];
  for (const slug of value?.split(",") ?? []) {
    const hero = bySlug.get(slug.trim());
    if (hero && !heroes.includes(hero)) heroes.push(hero);
    if (heroes.length === max) break;
  }
  return heroes;
}

/** The query value for a list of heroes, or null to drop it. */
export const heroListParam = (heroes: readonly HeroSummary[]) =>
  heroes.length > 0 ? heroes.map((h) => h.slug).join(",") : null;
