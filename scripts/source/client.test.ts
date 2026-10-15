import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSourceClient,
  SourceBlockedError,
  SourceRequestError,
} from "./client";
import { buildQuery } from "./query";

const ok = (data: unknown = { records: [] }) =>
  new Response(JSON.stringify({ code: 0, message: "OK", data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const firewall = () =>
  new Response("<html>blocked</html>", {
    status: 405,
    headers: { "content-type": "text/html" },
  });

/** Virtual clock: sleep() advances time instantly and records every wait. */
function virtualTime() {
  let t = 1_000_000;
  const waits: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(Math.round(ms));
      t += ms;
    },
    waits,
  };
}

function scriptedFetch(responses: Array<Response | Error>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no scripted response left");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const body = buildQuery(200, 1);

describe("createSourceClient", () => {
  let dir: string | null = null;
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = null;
  });

  it("spaces requests at least minIntervalMs apart and sends honest headers", async () => {
    const clock = virtualTime();
    const { fetchImpl, calls } = scriptedFetch([ok(), ok()]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      random: () => 0,
      minIntervalMs: 2000,
    });

    await client.query("https://example.test/base", 1, body);
    await client.query("https://example.test/base/", 2, body);

    expect(calls.map((c) => c.url)).toEqual([
      "https://example.test/base/1",
      "https://example.test/base/2",
    ]);
    expect(clock.waits).toEqual([2000]);
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^MetapickMLBB-Updater/);
    expect(headers).not.toHaveProperty("X-Forwarded-For");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      pageSize: 200,
      pageIndex: 1,
    });
  });

  it("retries 5xx responses with exponential backoff", async () => {
    const clock = virtualTime();
    const { fetchImpl } = scriptedFetch([
      new Response("oops", { status: 502 }),
      new Response("oops", { status: 503 }),
      ok({ total: 3 }),
    ]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      random: () => 0,
      minIntervalMs: 0,
    });

    const result = await client.query("https://example.test", 1, body);

    expect(result.data).toEqual({ total: 3 });
    expect(clock.waits).toEqual([2000, 4000]);
    expect(client.stats).toMatchObject({ requests: 3, retries: 2 });
  });

  it("gives up after maxRetries network errors", async () => {
    const clock = virtualTime();
    const { fetchImpl } = scriptedFetch([
      new Error("reset"),
      new Error("reset"),
      new Error("reset"),
    ]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      random: () => 0,
      minIntervalMs: 0,
      maxRetries: 2,
    });

    await expect(
      client.query("https://example.test", 1, body),
    ).rejects.toBeInstanceOf(SourceRequestError);
    expect(clock.waits).toEqual([2000, 4000]);
  });

  it("cools down once on a firewall block, then stops on the second", async () => {
    const clock = virtualTime();
    const { fetchImpl } = scriptedFetch([firewall(), ok(), firewall()]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      random: () => 0,
      minIntervalMs: 0,
      blockCooldownMs: 60_000,
    });

    await client.query("https://example.test", 1, body);
    expect(clock.waits).toEqual([60_000]);
    await expect(
      client.query("https://example.test", 2, body),
    ).rejects.toBeInstanceOf(SourceBlockedError);
  });

  it("rejects responses with a non-zero code without retrying", async () => {
    const clock = virtualTime();
    const { fetchImpl } = scriptedFetch([
      new Response(JSON.stringify({ code: 1001, message: "bad filter" }), {
        status: 200,
      }),
    ]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      minIntervalMs: 0,
    });

    await expect(client.query("https://example.test", 1, body)).rejects.toThrow(
      /code 1001/,
    );
    expect(client.stats.requests).toBe(1);
  });

  it("serves repeated queries from the disk cache", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "metapick-cache-"));
    const clock = virtualTime();
    const { fetchImpl, calls } = scriptedFetch([ok({ records: [1] })]);
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      minIntervalMs: 0,
      cacheDir: dir,
    });

    const first = await client.query("https://example.test", 7, body);
    const second = await client.query("https://example.test", 7, body);

    expect(second).toEqual(first);
    expect(calls).toHaveLength(1);
    expect(client.stats.cacheHits).toBe(1);
  });

  it("runs concurrent calls one at a time", async () => {
    const clock = virtualTime();
    let active = 0;
    let maxActive = 0;
    const fetchImpl = (async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return ok();
    }) as unknown as typeof fetch;
    const client = createSourceClient({
      fetchImpl,
      ...clock,
      minIntervalMs: 0,
    });

    await Promise.all(
      [1, 2, 3].map((id) => client.query("https://example.test", id, body)),
    );
    expect(maxActive).toBe(1);
  });
});
