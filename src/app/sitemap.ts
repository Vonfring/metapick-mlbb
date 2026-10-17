import type { MetadataRoute } from "next";
import { allNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { getHeroes, getLastUpdate } from "@/lib/data";

/**
 * Every page in the navigation plus the home page, one entry per hero, the
 * welcome page (it shows the tier list) and the about page. Built with the
 * site and refreshed with the game data.
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
    ...allNavItems.map((item) => entry(item.href)),
    ...heroes.map((hero) => entry(`/heroes/${hero.slug}`)),
    entry("/welcome"),
    { url: new URL("/about", siteConfig.url).toString() },
  ];
}
