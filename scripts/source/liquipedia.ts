import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Client for the Liquipedia Mobile Legends wiki API, the source for items,
 * emblems, talents and battle spells since the official MLBB Academy closed
 * on 2026-06-30.
 *
 * Follows https://liquipedia.net/api-terms-of-use: one request at a time, at
 * least 2 seconds apart, a User-Agent naming the project with contact
 * details, gzip, and responses cached on disk so reruns do not repeat
 * requests. Wiki text is CC BY-SA 3.0: anything shown from it credits
 * Liquipedia.
 */
export const LIQUIPEDIA_API_URL =
  "https://liquipedia.net/mobilelegends/api.php";

export const LIQUIPEDIA_USER_AGENT =
  "MetapickMLBB/1.0 (https://metapick-mlbb.vercel.app; https://github.com/Vonfring/metapick-mlbb; personal non-commercial project)";

export class LiquipediaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LiquipediaError";
  }
}

export type LiquipediaClientOptions = {
  apiUrl?: string;
  userAgent?: string;
  minIntervalMs?: number;
  jitterMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  timeoutMs?: number;
  /** Directory for cached responses. null disables caching. */
  cacheDir?: string | null;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  log?: (message: string) => void;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createLiquipediaClient(options: LiquipediaClientOptions = {}) {
  const {
    apiUrl = LIQUIPEDIA_API_URL,
    userAgent = LIQUIPEDIA_USER_AGENT,
    minIntervalMs = 2_500,
    jitterMs = 500,
    maxRetries = 3,
    backoffBaseMs = 5_000,
    timeoutMs = 30_000,
    cacheDir = null,
    cacheTtlMs = 20 * 60 * 60 * 1000,
    fetchImpl = fetch,
    sleep = defaultSleep,
    now = Date.now,
    random = Math.random,
    log = () => {},
  } = options;

  const stats = { requests: 0, retries: 0, cacheHits: 0 };
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let queue: Promise<unknown> = Promise.resolve();

  async function pace() {
    const wait = lastRequestAt + minIntervalMs + random() * jitterMs - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
  }

  function cacheFile(url: string) {
    if (!cacheDir) return null;
    return path.join(
      cacheDir,
      `${createHash("sha256").update(url).digest("hex").slice(0, 32)}.json`,
    );
  }

  async function send(url: string): Promise<unknown> {
    const file = cacheFile(url);
    if (file) {
      try {
        const cached = JSON.parse(await readFile(file, "utf8")) as {
          savedAt: number;
          response: unknown;
        };
        if (now() - cached.savedAt <= cacheTtlMs) {
          stats.cacheHits += 1;
          return cached.response;
        }
      } catch {
        // not cached yet
      }
    }

    for (let attempt = 0; ; attempt += 1) {
      await pace();
      stats.requests += 1;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: {
            "User-Agent": userAgent,
            "Accept-Encoding": "gzip",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (attempt < maxRetries) {
          stats.retries += 1;
          log(
            `network error (${(error as Error).message}); retry ${attempt + 1}/${maxRetries}`,
          );
          await sleep(backoffBaseMs * 2 ** attempt);
          continue;
        }
        throw new LiquipediaError(
          `Network error after ${attempt + 1} attempts: ${(error as Error).message}`,
        );
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          stats.retries += 1;
          log(`HTTP ${response.status}; retry ${attempt + 1}/${maxRetries}`);
          await sleep(backoffBaseMs * 2 ** attempt);
          continue;
        }
      }
      if (!response.ok)
        throw new LiquipediaError(
          `HTTP ${response.status} from Liquipedia`,
          response.status,
        );

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new LiquipediaError(
          "Liquipedia returned a body that is not JSON",
          response.status,
        );
      }
      const apiError = (json as { error?: { code?: string; info?: string } })
        .error;
      if (apiError)
        throw new LiquipediaError(
          `Liquipedia API error ${apiError.code}: ${apiError.info}`,
        );

      if (file) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(
          file,
          JSON.stringify({ savedAt: now(), response: json }),
        );
      }
      return json;
    }
  }

  /** GET the API with these parameters (format=json, formatversion=2). One call at a time. */
  function get(params: Record<string, string>): Promise<unknown> {
    const url = `${apiUrl}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
    const run = queue.then(() => send(url));
    queue = run.catch(() => undefined);
    return run;
  }

  return { get, stats };
}

export type LiquipediaClient = ReturnType<typeof createLiquipediaClient>;

export type WikiPage = {
  title: string;
  content: string;
  timestamp: string | null;
};

type RevisionsResponse = {
  query?: {
    pages?: {
      title: string;
      missing?: boolean;
      revisions?: {
        timestamp?: string;
        slots?: { main?: { content?: string } };
      }[];
    }[];
    redirects?: { from: string; to: string }[];
  };
};

/** Current wikitext of the given pages, 50 titles per request, keyed by requested title. */
export async function fetchWikitext(
  client: LiquipediaClient,
  titles: string[],
): Promise<Map<string, WikiPage>> {
  const pages = new Map<string, WikiPage>();
  for (let start = 0; start < titles.length; start += 50) {
    const batch = titles.slice(start, start + 50);
    const json = (await client.get({
      action: "query",
      prop: "revisions",
      rvprop: "content|timestamp",
      rvslots: "main",
      redirects: "1",
      titles: batch.join("|"),
    })) as RevisionsResponse;
    const redirectedFrom = new Map<string, string>();
    for (const redirect of json.query?.redirects ?? [])
      redirectedFrom.set(redirect.to, redirect.from);
    for (const page of json.query?.pages ?? []) {
      const revision = page.revisions?.[0];
      const content = revision?.slots?.main?.content;
      if (page.missing || content === undefined) continue;
      const requested = redirectedFrom.get(page.title) ?? page.title;
      pages.set(requested, {
        title: page.title,
        content,
        timestamp: revision?.timestamp ?? null,
      });
    }
  }
  return pages;
}

type CategoryResponse = {
  query?: { categorymembers?: { title: string; ns: number }[] };
  continue?: Record<string, string>;
};

/** Titles of the main-namespace pages in a category. */
export async function fetchCategoryMembers(
  client: LiquipediaClient,
  category: string,
): Promise<string[]> {
  const titles: string[] = [];
  let next: Record<string, string> | undefined = {};
  for (let page = 0; next && page < 10; page += 1) {
    const json = (await client.get({
      action: "query",
      list: "categorymembers",
      cmtitle: category,
      cmnamespace: "0",
      cmlimit: "500",
      ...next,
    })) as CategoryResponse;
    titles.push(
      ...(json.query?.categorymembers ?? []).map((member) => member.title),
    );
    next = json.continue;
  }
  return titles;
}
