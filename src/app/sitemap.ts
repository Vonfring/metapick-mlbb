import type { MetadataRoute } from "next";
import { allNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getHeroes, getLastUpdate } from "@/lib/data";

/**
 * The home (welcome) page and the app's start, every page in the navigation,
 * one entry per hero and the about page. Built with the site and refreshed
 * with the game data, which the welcome page and hero pages show.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [heroes, lastUpdate] = await Promise.all([
    getHeroes(),
    getLastUpdate(),
  ]);
  const lastModified = lastUpdate ? new Date(lastUpdate) : undefined;
  const entry = (path: string): MetadataRoute.Sitemap[number] => ({
    url: new URL(path, siteConfig.url).toString(),
    lastModified,
  });

  return [
    entry("/"),
    entry("/app"),
    ...allNavItems.map((item) => entry(item.href)),
    ...heroes.map((hero) => entry(`/heroes/${hero.slug}`)),
    { url: new URL("/about", siteConfig.url).toString() },
  ];
}
