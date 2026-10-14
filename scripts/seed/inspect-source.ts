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
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const outDir = path.resolve(process.argv[2] ?? "seed/official/_inspect");

type InspectOptions = {
  /** Skip the API calls and only crawl the official site's scripts. */
  siteOnly?: boolean;
  maxScripts?: number;
  pages?: string[];
  /** Extra strings to find in the scripts (source IDs, field names). */
  terms?: string[];
  /** Save the HTML of each crawled page (first 200 KB). */
  savePages?: boolean;
  /** Base URLs to try every Academy source ID against (2 records each). */
  probeBases?: string[];
  /** Save the full text of fetched scripts whose URL contains one of these strings. */
  saveScripts?: string[];
};

async function readOptions(): Promise<InspectOptions> {
  try {
    const request = JSON.parse(await readFile("seed/fetch-request.json", "utf8")) as {
      inspect?: InspectOptions;
    };
    return request.inspect ?? {};
  } catch {
    return {};
  }
}
const OFFICIAL_SITE = "https://www.mobilelegends.com";

async function save(name: string, data: unknown) {
  await writeFile(path.join(outDir, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`saved ${name}.json`);
}

const SNIPPET_TERMS = [
  "sub_hero_last",
  "sub_hero",
  "increase_win_rate",
  "main_hero_appearance_rate",
  "match_type",
  "bigrank",
  "big_rank",
  "real_road",
];

/**
 * Find the API paths the official site's own scripts call, and keep short
 * code snippets around the field names we care about. The snippets show how
 * the official UI labels each list (for example which one means "counters").
 */
async function discoverApiPaths(options: InspectOptions) {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const get = async (url: string) => {
    await sleep(2000);
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      return { status: response.status, text: response.ok ? await response.text() : "" };
    } catch (error) {
      return { status: 0, text: "", error: (error as Error).message };
    }
  };

  const pages = options.pages ?? ["/", "/hero", "/rank"];
  const terms = [...SNIPPET_TERMS, ...(options.terms ?? [])];
  const queue: string[] = [];
  const seen = new Set<string>();
  const enqueue = (url: string) => {
    if (!seen.has(url)) {
      seen.add(url);
      queue.push(url);
    }
  };
  const pageStatus: Record<string, number> = {};
  for (const page of pages) {
    const { status, text } = await get(OFFICIAL_SITE + page);
    pageStatus[page] = status;
    if (options.savePages && text) {
      const file = page === "/" ? "home" : page.replace(/^\//, "").replace(/\//g, "_");
      await mkdir(path.join(outDir, "pages"), { recursive: true });
      await writeFile(path.join(outDir, "pages", `${file}.html`), text.slice(0, 200_000));
    }
    console.log(`GET ${page} -> ${status}`);
    for (const match of text.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.js[^"]*)"/g)) {
      enqueue(new URL(match[1]!, OFFICIAL_SITE).toString());
    }
  }
  const allowedHosts = new Set(queue.map((url) => new URL(url).host));

  const MAX_SCRIPTS = options.maxScripts ?? 40;
  const apiMatches = new Map<string, Set<string>>();
  const snippets: Record<string, { script: string; text: string }[]> = {};
  let fetched = 0;
  while (queue.length > 0 && fetched < MAX_SCRIPTS) {
    const script = queue.shift()!;
    fetched += 1;
    const { text } = await get(script);
    if (!text) continue;
    if (options.saveScripts?.some((part) => script.includes(part))) {
      await mkdir(path.join(outDir, "scripts"), { recursive: true });
      await writeFile(path.join(outDir, "scripts", script.split("/").pop()!.split("?")[0]!), text);
    }

    for (const match of text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]*moontontech\.com[^"'`\s)]*|gms\/source\/\d+(?:\/\d+)?/g)) {
      if (!apiMatches.has(match[0])) apiMatches.set(match[0], new Set());
      apiMatches.get(match[0])!.add(script);
    }
    for (const term of terms) {
      const list = (snippets[term] ??= []);
      let index = text.indexOf(term);
      while (index !== -1 && list.length < 6) {
        list.push({ script, text: text.slice(Math.max(0, index - 250), index + 250) });
        index = text.indexOf(term, index + term.length + 250);
      }
    }
    // Lazy-loaded chunks referenced by this script, on the same hosts.
    for (const match of text.matchAll(/["'`]((?:\.{0,2}\/)?[\w./-]+\.js)["'`]/g)) {
      try {
        const url = new URL(match[1]!, script);
        if (allowedHosts.has(url.host)) enqueue(url.toString());
      } catch {
        // not a URL
      }
    }
  }

  return {
    pageStatus,
    scriptsFetched: fetched,
    scriptsQueued: queue.length,
    apiMatches: [...apiMatches.entries()].map(([value, inScripts]) => ({ value, scripts: [...inScripts] })),
    snippets,
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const options = await readOptions();
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

  if (!options.siteOnly) {
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
  }

  for (const base of options.probeBases ?? []) {
    const app = /source\/(\d+)/.exec(base)?.[1] ?? "base";
    for (const [name, id] of Object.entries(ACADEMY_SOURCE_IDS)) {
      await attempt(`probe-${app}-${name}`, () => client.query(base, id, buildQuery(2, 1)));
    }
  }

  let academyBase = ACADEMY_BASE_URL;
  await attempt("official-site-api-paths", async () => {
    const discovered = await discoverApiPaths(options);
    if (!academyBase) {
      const appIds = [
        ...new Set(
          discovered.apiMatches
            .map((m) => /gms\/source\/(\d+)/.exec(m.value)?.[1])
            .filter((id): id is string => Boolean(id) && id !== "2669606"),
        ),
      ];
      if (appIds[0]) academyBase = `https://api.gms.moontontech.com/api/gms/source/${appIds[0]}`;
      return { ...discovered, otherAppIds: appIds, academyBaseGuess: academyBase || null };
    }
    return { ...discovered, academyBaseGuess: academyBase || null };
  });

  if (academyBase && !options.siteOnly) {
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
  } else if (!academyBase) {
    errors.academy = "No Academy base path found; set MLBB_ACADEMY_BASE_URL and run again.";
  }

  await save("_summary", { stats: client.stats, academyBase: academyBase || null, errors });
  console.log(`done: ${client.stats.requests} API requests, ${Object.keys(errors).length} errors`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
