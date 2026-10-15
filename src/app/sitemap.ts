import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getHeroes, getLastUpdate } from "@/lib/data";

/** Every page, plus one entry per hero. Built with the site and refreshed with the game data. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [heroes, lastUpdate] = await Promise.all([
    getHeroes(),
    getLastUpdate(),
  ]);
  const updated = lastUpdate ? new Date(lastUpdate) : undefined;
  const page = (
    path: string,
    changeFrequency: "daily" | "weekly" | "monthly",
    priority: number,
  ): MetadataRoute.Sitemap[number] => ({
    url: new URL(path, siteConfig.url).toString(),
    lastModified: changeFrequency === "monthly" ? undefined : updated,
    changeFrequency,
    priority,
  });

  return [
    page("/", "daily", 1),
    page("/tier-list", "daily", 0.9),
    page("/statistics", "daily", 0.8),
    page("/counter-pick", "daily", 0.9),
    page("/matchup", "daily", 0.7),
    page("/team-composition", "weekly", 0.7),
    page("/draft", "weekly", 0.8),
    page("/heroes", "weekly", 0.8),
    page("/items", "weekly", 0.6),
    page("/emblems", "weekly", 0.6),
    page("/about", "monthly", 0.3),
    ...heroes.map((hero) => page(`/heroes/${hero.slug}`, "daily", 0.7)),
  ];
}
