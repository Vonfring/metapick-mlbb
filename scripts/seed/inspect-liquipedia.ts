/**
 * One-off look at the Liquipedia data before writing the catalog importer.
 *
 *   pnpm seed:inspect-liquipedia [outDir]
 *
 * Lists the wiki's categories, the pages in the item, emblem, talent, spell
 * and patch categories, and saves the wikitext of a few sample pages (about
 * 15 requests, 2.5 seconds apart). Nothing here writes to the database.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLiquipediaClient, fetchCategoryMembers, fetchWikitext } from "../source/liquipedia";

const outDir = path.resolve(process.argv[2] ?? "seed/official/_inspect/liquipedia");

const INTERESTING = /item|equip|emblem|talent|spell|patch/i;
const SAMPLE_PAGES = [
  "Portal:Items",
  "Items",
  "Equipment",
  "Blade of Despair",
  "Warrior Boots",
  "Emblems",
  "Emblem",
  "Portal:Emblems",
  "Talents",
  "Battle Spells",
  "Battle Spell",
  "Flicker",
];

async function save(name: string, data: unknown) {
  await writeFile(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`saved ${name}.json`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const client = createLiquipediaClient({ log: (message) => console.log(`  ${message}`) });
  const errors: Record<string, string> = {};

  const categoriesResponse = (await client.get({
    action: "query",
    list: "allcategories",
    aclimit: "500",
    acprop: "size",
  })) as { query?: { allcategories?: { category: string; size?: number; pages?: number }[] } };
  const categories = categoriesResponse.query?.allcategories ?? [];
  await save("categories", categories);

  const members: Record<string, string[]> = {};
  for (const { category } of categories.filter((c) => INTERESTING.test(c.category)).slice(0, 12)) {
    try {
      members[category] = await fetchCategoryMembers(client, `Category:${category}`);
    } catch (error) {
      errors[`category ${category}`] = (error as Error).message;
    }
  }
  await save("category-members", members);

  const samples = [...SAMPLE_PAGES];
  for (const titles of Object.values(members)) samples.push(...titles.slice(0, 3));
  const pages = await fetchWikitext(client, [...new Set(samples)].slice(0, 50));
  await save("sample-pages", Object.fromEntries(pages));

  await save("_summary", {
    stats: client.stats,
    categoriesMatched: Object.fromEntries(Object.entries(members).map(([name, list]) => [name, list.length])),
    pagesFound: [...pages.keys()],
    pagesMissing: [...new Set(samples)].filter((title) => !pages.has(title)),
    errors,
  });
  console.log(`done: ${client.stats.requests} requests`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
