/**
 * One-off look at the official data source before writing the importer.
 *
 *   pnpm seed:inspect [outDir]
 *
 * Saves a handful of raw responses (a few heroes per call, about 15 requests
 * in total, 2 seconds apart) and the API paths referenced by the official
 * website's scripts, so field names and the "Academy" base path can be
 * confirmed. Nothing here writes to the database.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSourceClient } from "../source/client";
import {
  ACADEMY_BASE_URL,
  ACADEMY_SOURCE_IDS,
  HERO_SOURCE_IDS,
  MATCH_TYPE,
  PATCH_NOTES_FORM_ID,
  RANK_CODES,
  SOURCE_BASE_URL,
  STATS_SOURCE_IDS,
  USER_AGENT,
} from "../source/config";
import { buildQuery, eq, sortBy } from "../source/query";

const outDir = path.resolve(process.argv[2] ?? ".cache/inspect");
const OFFICIAL_SITE = "https://www.mobilelegends.com";

async function save(name: string, data: unknown) {
  await writeFile(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`saved ${name}.json`);
}

/** Find API base paths the official site's own scripts call. */
async function discoverApiPaths() {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const get = async (url: string) => {
    await sleep(2000);
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    return { status: response.status, text: response.ok ? await response.text() : "" };
  };

  const pages = ["/", "/hero", "/rank"];
  const scripts = new Set<string>();
  for (const page of pages) {
    const { status, text } = await get(OFFICIAL_SITE + page);
    console.log(`GET ${page} -> ${status}`);
    for (const match of text.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)) {
      scripts.add(new URL(match[1]!, OFFICIAL_SITE).toString());
    }
  }

  const found = new Map<string, Set<string>>();
  for (const script of [...scripts].slice(0, 25)) {
    const { text } = await get(script);
    for (const match of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]*moontontech\.com[^"'`\s)]*|gms\/source\/\d+(?:\/\d+)?/g)) {
      const key = match[0];
      if (!found.has(key)) found.set(key, new Set());
      found.get(key)!.add(script);
    }
  }
  return {
    scripts: [...scripts],
    matches: [...found.entries()].map(([value, inScripts]) => ({ value, scripts: [...inScripts] })),
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const client = createSourceClient({ log: (message) => console.log(`  ${message}`) });
  const errors: Record<string, string> = {};

  async function attempt(name: string, run: () => Promise<unknown>) {
    try {
      await save(name, await run());
    } catch (error) {
      errors[name] = (error as Error).message;
      console.warn(`failed ${name}: ${(error as Error).message}`);
    }
  }

  await attempt("hero-list", () =>
    client.query(SOURCE_BASE_URL, HERO_SOURCE_IDS.heroList, buildQuery(5, 1, { sorts: [sortBy("hero_id", "desc")] })),
  );
  await attempt("hero-list-count", () =>
    client.query(
      SOURCE_BASE_URL,
      HERO_SOURCE_IDS.heroList,
      buildQuery(1, 1, { fields: ["hero_id", "hero.data.name"], sorts: [sortBy("hero_id", "desc")] }),
    ),
  );
  for (const heroId of [1, 30]) {
    await attempt(`hero-detail-${heroId}`, () =>
      client.query(SOURCE_BASE_URL, HERO_SOURCE_IDS.heroList, buildQuery(1, 1, { filters: [eq("hero_id", heroId)] })),
    );
  }
  for (const [label, matchType] of Object.entries(MATCH_TYPE)) {
    await attempt(`stats-mythic-7d-${label}`, () =>
      client.query(
        SOURCE_BASE_URL,
        STATS_SOURCE_IDS[7],
        buildQuery(2, 1, {
          filters: [eq("bigrank", RANK_CODES.mythic), eq("match_type", matchType)],
          sorts: [sortBy("main_hero_win_rate", "desc")],
        }),
      ),
    );
  }
  await attempt("stats-all-1d-page-size", () =>
    client.query(
      SOURCE_BASE_URL,
      STATS_SOURCE_IDS[1],
      buildQuery(200, 1, {
        filters: [eq("bigrank", RANK_CODES.all), eq("match_type", MATCH_TYPE.counters)],
        fields: ["main_heroid", "main_hero_win_rate", "main_hero_appearance_rate", "main_hero_ban_rate"],
      }),
    ),
  );

  let academyBase = ACADEMY_BASE_URL;
  await attempt("official-site-api-paths", async () => {
    const discovered = await discoverApiPaths();
    if (!academyBase) {
      const candidates = discovered.matches
        .map((m) => /gms\/source\/(\d+)$/.exec(m.value)?.[1])
        .filter((id): id is string => Boolean(id) && id !== "2669606");
      if (candidates[0]) academyBase = `https://api.gms.moontontech.com/api/gms/source/${candidates[0]}`;
    }
    return { ...discovered, academyBaseGuess: academyBase || null };
  });

  if (academyBase) {
    const academy: Array<[string, number, ReturnType<typeof buildQuery>]> = [
      ["academy-equipment-expanded", ACADEMY_SOURCE_IDS.equipmentExpanded, buildQuery(3, 1)],
      ["academy-equipment", ACADEMY_SOURCE_IDS.equipment, buildQuery(3, 1)],
      ["academy-emblems", ACADEMY_SOURCE_IDS.emblems, buildQuery(3, 1)],
      ["academy-roles", ACADEMY_SOURCE_IDS.roles, buildQuery(10, 1, { sorts: [sortBy("emblem_id", "asc")], object: [] })],
      ["academy-spells", ACADEMY_SOURCE_IDS.spells, buildQuery(3, 1)],
      [
        "academy-builds-hero-1",
        ACADEMY_SOURCE_IDS.builds,
        buildQuery(3, 1, { filters: [eq("heroid", 1), eq("real_road", 5), eq("big_rank", RANK_CODES.mythic)] }),
      ],
      [
        "academy-patch-notes",
        ACADEMY_SOURCE_IDS.posts,
        buildQuery(1, 1, {
          filters: [eq("formId", PATCH_NOTES_FORM_ID)],
          sorts: [sortBy("createdAt", "desc")],
          type: "form.item.all",
          object: [2675413],
        }),
      ],
    ];
    for (const [name, id, body] of academy) await attempt(name, () => client.query(academyBase, id, body));
  } else {
    errors.academy = "No Academy base path found; set MLBB_ACADEMY_BASE_URL and run again.";
  }

  await save("_summary", { stats: client.stats, academyBase: academyBase || null, errors });
  console.log(`done: ${client.stats.requests} API requests, ${Object.keys(errors).length} errors`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
