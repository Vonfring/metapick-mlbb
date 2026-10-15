/**
 * Items, emblems, talents and battle spells from the Liquipedia Mobile
 * Legends wiki into seed/liquipedia/*.json (CC BY-SA 3.0, credited in the
 * app). The official MLBB Academy that used to provide them closed on
 * 2026-06-30.
 *
 *   pnpm seed:catalog                                  download, parse, write
 *   pnpm seed:catalog --download-only --save-raw FILE  only save the raw pages
 *   pnpm seed:catalog --from-raw FILE                  parse a saved download
 *
 * A full download is 5 requests (two category lists, then 50 pages per
 * request), 2.5 seconds apart. Emblem sets and talents have no pages of
 * their own: they all come from the emblem portal.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  battleSpellRowSchema,
  emblemRowSchema,
  emblemTalentRowSchema,
  itemRowSchema,
} from "@/lib/data/schemas";
import { createLiquipediaClient } from "../source/liquipedia";
import { parseCatalog, type RawCatalog } from "../source/transform/liquipedia";
import { downloadCatalog } from "../updater/wiki";

const OUT_DIR = path.resolve("seed", "liquipedia");

async function writeJson(name: string, data: unknown) {
  await writeFile(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote seed/liquipedia/${name}`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      "download-only": { type: "boolean", default: false },
      "save-raw": { type: "string" },
      "from-raw": { type: "string" },
    },
  });

  let raw: RawCatalog;
  if (values["from-raw"]) {
    raw = JSON.parse(await readFile(values["from-raw"], "utf8")) as RawCatalog;
  } else {
    const client = createLiquipediaClient({
      cacheDir: path.resolve(".cache", "liquipedia"),
      log: (message) => console.log(`  ${message}`),
    });
    raw = await downloadCatalog(client);
    console.log(`downloaded ${Object.keys(raw.pages).length} pages in ${client.stats.requests} requests`);
  }
  if (values["save-raw"]) {
    await mkdir(path.dirname(values["save-raw"]), { recursive: true });
    await writeFile(values["save-raw"], `${JSON.stringify(raw, null, 1)}\n`);
    console.log(`saved the raw pages to ${values["save-raw"]}`);
  }
  if (values["download-only"]) return;

  const { items, emblems, talents, spells, revisedAt, warnings } = parseCatalog(raw);
  // Same checks the seed loader runs, so a bad parse fails here instead of later.
  z.array(itemRowSchema).parse(items);
  z.array(emblemRowSchema).parse(emblems);
  z.array(emblemTalentRowSchema).parse(talents);
  z.array(battleSpellRowSchema).parse(spells);
  await mkdir(OUT_DIR, { recursive: true });
  await writeJson("meta.json", {
    fetched_at: raw.fetched_at,
    source: "Liquipedia Mobile Legends wiki (https://liquipedia.net/mobilelegends)",
    license: "CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)",
    revised_at: revisedAt,
    notes: warnings.length > 0 ? warnings.join("\n") : undefined,
  });
  await writeJson("items.json", items);
  await writeJson("emblems.json", emblems);
  await writeJson("talents.json", talents);
  await writeJson("spells.json", spells);

  console.log(
    `\n${items.length} items, ${emblems.length} emblems, ${talents.length} talents, ${spells.length} spells`,
  );
  if (warnings.length > 0) {
    console.warn(`${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`  - ${warning}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
