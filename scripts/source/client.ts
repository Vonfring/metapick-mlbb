import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PACING, USER_AGENT } from "./config";
import type { SourceQuery } from "./query";

/** The firewall refused us twice in a row. The job must stop and keep the old data. */
export class SourceBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceBlockedError";
  }
}

export class SourceRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SourceRequestError";
  }
}

const envelopeSchema = z.looseObject({
  code: z.number(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

export type SourceEnvelope = z.infer<typeof envelopeSchema>;

export type SourceClientOptions = {
  userAgent?: string;
  lang?: string;
  minIntervalMs?: number;
  jitterMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  blockCooldownMs?: number;
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

export type SourceClientStats = {
  requests: number;
  retries: number;
  cacheHits: number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A 405 or 429 answered with an HTML page is the firewall, not the API. */
function isBlocked(response: Response) {
  const type = response.headers.get("content-type") ?? "";
  return (
    (response.status === 405 || response.status === 429) &&
    type.includes("text/html")
  );
}

function isRetryable(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Sequential, rate-limited client for the official data source.
 * One request at a time, a minimum gap plus jitter between requests,
 * exponential backoff on transient errors, and a hard stop if the
 * firewall blocks us after one cool-down.
 */
export function createSourceClient(options: SourceClientOptions = {}) {
  const {
    userAgent = USER_AGENT,
    lang = "en",
    minIntervalMs = PACING.minIntervalMs,
    jitterMs = PACING.jitterMs,
    maxRetries = PACING.maxRetries,
    backoffBaseMs = PACING.backoffBaseMs,
    blockCooldownMs = PACING.blockCooldownMs,
    timeoutMs = PACING.timeoutMs,
    cacheDir = null,
    cacheTtlMs = PACING.cacheTtlMs,
    fetchImpl = fetch,
    sleep = defaultSleep,
    now = Date.now,
    random = Math.random,
    log = () => {},
  } = options;

  const stats: SourceClientStats = { requests: 0, retries: 0, cacheHits: 0 };
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let cooldownUsed = false;
  let queue: Promise<unknown> = Promise.resolve();

  async function pace() {
    const gap = minIntervalMs + random() * jitterMs;
    const wait = lastRequestAt + gap - now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
  }

  function backoff(attempt: number) {
    return backoffBaseMs * 2 ** attempt + random() * (backoffBaseMs / 2);
  }

  function cacheFile(url: string, body: unknown) {
    if (!cacheDir) return null;
    const key = createHash("sha256")
      .update(`${url}\n${lang}\n${JSON.stringify(body)}`)
      .digest("hex")
      .slice(0, 32);
    return path.join(cacheDir, `${key}.json`);
  }

  async function readCached(file: string | null) {
    if (!file) return null;
    try {
      const cached = JSON.parse(await readFile(file, "utf8")) as {
        savedAt: number;
        response: SourceEnvelope;
      };
      if (now() - cached.savedAt > cacheTtlMs) return null;
      return cached.response;
    } catch {
      return null;
    }
  }

  async function writeCached(file: string | null, response: SourceEnvelope) {
    if (!file) return;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ savedAt: now(), response }));
  }

  async function send(url: string, body: SourceQuery): Promise<SourceEnvelope> {
    const file = cacheFile(url, body);
    const cached = await readCached(file);
    if (cached) {
      stats.cacheHits += 1;
      return cached;
    }

    for (let attempt = 0; ; attempt += 1) {
      await pace();
      stats.requests += 1;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": userAgent,
            "x-lang": lang,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (attempt < maxRetries) {
          stats.retries += 1;
          log(
            `network error (${(error as Error).message}); retry ${attempt + 1}/${maxRetries}`,
          );
          await sleep(backoff(attempt));
          continue;
        }
        throw new SourceRequestError(
          `Network error after ${attempt + 1} attempts: ${(error as Error).message}`,
        );
      }

      if (isBlocked(response)) {
        if (!cooldownUsed) {
          cooldownUsed = true;
          stats.retries += 1;
          log(
            `blocked by the firewall (HTTP ${response.status}); cooling down ${blockCooldownMs / 1000}s`,
          );
          await sleep(blockCooldownMs);
          continue;
        }
        throw new SourceBlockedError(
          `Blocked by the source firewall twice (HTTP ${response.status}). Stopping to avoid hammering it.`,
        );
      }

      if (!response.ok) {
        if (isRetryable(response.status) && attempt < maxRetries) {
          stats.retries += 1;
          log(`HTTP ${response.status}; retry ${attempt + 1}/${maxRetries}`);
          await sleep(backoff(attempt));
          continue;
        }
        throw new SourceRequestError(
          `HTTP ${response.status} from the source`,
          response.status,
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new SourceRequestError(
          "The source returned a body that is not JSON",
          response.status,
        );
      }

      const parsed = envelopeSchema.safeParse(json);
      if (!parsed.success) {
        throw new SourceRequestError(
          "The source response does not have the expected envelope",
        );
      }
      if (parsed.data.code !== 0) {
        throw new SourceRequestError(
          `The source answered with code ${parsed.data.code}: ${parsed.data.message ?? "no message"}`,
        );
      }

      await writeCached(file, parsed.data);
      return parsed.data;
    }
  }

  /** POST a query to `${baseUrl}/${sourceId}`. Calls run strictly one at a time. */
  function query(
    baseUrl: string,
    sourceId: number,
    body: SourceQuery,
  ): Promise<SourceEnvelope> {
    if (!baseUrl) {
      return Promise.reject(
        new SourceRequestError(`No base URL configured for source ${sourceId}`),
      );
    }
    const url = `${baseUrl.replace(/\/$/, "")}/${sourceId}`;
    const run = queue.then(() => send(url, body));
    queue = run.catch(() => undefined);
    return run;
  }

  return { query, stats };
}

export type SourceClient = ReturnType<typeof createSourceClient>;
