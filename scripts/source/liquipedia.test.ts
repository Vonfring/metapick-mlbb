import { describe, expect, it } from "vitest";
import {
  createLiquipediaClient,
  fetchCategoryMembers,
  fetchWikitext,
  LIQUIPEDIA_USER_AGENT,
  LiquipediaError,
} from "./liquipedia";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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

function scriptedFetch(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no scripted response left");
    return next;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("createLiquipediaClient", () => {
  it("sends JSON requests with the project User-Agent, at least 2.5 s apart", async () => {
    const clock = virtualTime();
    const { fetchImpl, calls } = scriptedFetch([
      json({ query: {} }),
      json({ query: {} }),
    ]);
    const client = createLiquipediaClient({
      fetchImpl,
      ...clock,
      random: () => 0,
    });

    await client.get({ action: "query", list: "allcategories" });
    await client.get({ action: "query", list: "allcategories", acfrom: "B" });

    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("formatversion")).toBe("2");
    expect(url.searchParams.get("list")).toBe("allcategories");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe(LIQUIPEDIA_USER_AGENT);
    expect(headers["Accept-Encoding"]).toBe("gzip");
    expect(clock.waits).toEqual([2_500]);
  });

  it("retries 429 and 5xx with backoff, then gives up", async () => {
    const clock = virtualTime();
    const { fetchImpl } = scriptedFetch([
      json({}, 503),
      json({}, 429),
      json({ query: { ok: 1 } }),
    ]);
    const client = createLiquipediaClient({
      fetchImpl,
      ...clock,
      random: () => 0,
    });
    await expect(client.get({ action: "query" })).resolves.toEqual({
      query: { ok: 1 },
    });
    expect(client.stats).toMatchObject({ requests: 3, retries: 2 });

    const failing = scriptedFetch([json({}, 500), json({}, 500)]);
    const strict = createLiquipediaClient({
      fetchImpl: failing.fetchImpl,
      ...clock,
      maxRetries: 1,
    });
    await expect(strict.get({ action: "query" })).rejects.toThrow("HTTP 500");
  });

  it("turns an API error object into a LiquipediaError", async () => {
    const { fetchImpl } = scriptedFetch([
      json({ error: { code: "badvalue", info: "Unrecognized value" } }),
    ]);
    const client = createLiquipediaClient({ fetchImpl, ...virtualTime() });
    await expect(client.get({ action: "nope" })).rejects.toBeInstanceOf(
      LiquipediaError,
    );
  });
});

describe("fetchWikitext", () => {
  it("keys pages by the requested title, following redirects and skipping missing pages", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      json({
        query: {
          redirects: [{ from: "BoD", to: "Blade of Despair" }],
          pages: [
            {
              title: "Blade of Despair",
              revisions: [
                {
                  timestamp: "2026-09-01T00:00:00Z",
                  slots: { main: { content: "{{Infobox item}}" } },
                },
              ],
            },
            { title: "Nothing Here", missing: true },
          ],
        },
      }),
    ]);
    const client = createLiquipediaClient({ fetchImpl, ...virtualTime() });
    const pages = await fetchWikitext(client, ["BoD", "Nothing Here"]);

    expect(new URL(calls[0]!.url).searchParams.get("titles")).toBe(
      "BoD|Nothing Here",
    );
    expect([...pages.keys()]).toEqual(["BoD"]);
    expect(pages.get("BoD")).toEqual({
      title: "Blade of Despair",
      content: "{{Infobox item}}",
      timestamp: "2026-09-01T00:00:00Z",
    });
  });
});

describe("fetchCategoryMembers", () => {
  it("follows continuation", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      json({
        query: { categorymembers: [{ title: "A", ns: 0 }] },
        continue: { cmcontinue: "page|B", continue: "-||" },
      }),
      json({ query: { categorymembers: [{ title: "B", ns: 0 }] } }),
    ]);
    const client = createLiquipediaClient({ fetchImpl, ...virtualTime() });
    await expect(
      fetchCategoryMembers(client, "Category:Items"),
    ).resolves.toEqual(["A", "B"]);
    expect(new URL(calls[1]!.url).searchParams.get("cmcontinue")).toBe(
      "page|B",
    );
  });
});
