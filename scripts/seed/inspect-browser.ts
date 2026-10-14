/**
 * Open official pages in headless Chromium and record the data requests the
 * pages make themselves. Used to find where the Academy data (items, emblems,
 * battle spells, builds) comes from, since those source IDs do not answer
 * under the hero app path.
 *
 *   pnpm seed:inspect-browser [outDir]
 *
 * One visit per page with a pause in between, like a person browsing; images,
 * fonts and media are not downloaded. For every API call it saves the method,
 * URL, body and X-* headers, plus the first records of the JSON response.
 * Nothing here writes to the database.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const SITE = process.env.INSPECT_SITE ?? "https://www.mobilelegends.com";
const outDir = path.resolve(process.argv[2] ?? "seed/official/_inspect/browser");

type BrowserOptions = {
  /** Paths to open first. */
  pages?: string[];
  /** Also open same-site links whose path contains one of these strings. */
  follow?: string[];
  /** Upper bound on the number of pages opened. */
  maxPages?: number;
};

type Exchange = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  status?: number;
  contentType?: string;
  response?: unknown;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readOptions(): Promise<BrowserOptions> {
  try {
    const request = JSON.parse(await readFile("seed/fetch-request.json", "utf8")) as { browser?: BrowserOptions };
    return request.browser ?? {};
  } catch {
    return {};
  }
}

function parseMaybeJson(text: string | null | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

/** Keep the envelope and the first records of list responses; cap everything else. */
function summarize(json: unknown): unknown {
  const records = (json as { data?: { records?: unknown[]; total?: number } })?.data?.records;
  if (Array.isArray(records)) {
    const envelope = json as { code?: unknown; message?: unknown; data: { total?: number } };
    return {
      code: envelope.code,
      message: envelope.message,
      total: envelope.data.total,
      recordCount: records.length,
      records: records.slice(0, 3),
    };
  }
  const text = JSON.stringify(json);
  return text.length <= 400_000 ? json : { truncated: true, length: text.length, start: text.slice(0, 400_000) };
}

function keepHeaders(headers: Record<string, string>) {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.startsWith("x-") || name === "content-type" || name.includes("sign") || name === "authorization") {
      kept[name] = value;
    }
  }
  kept["(all header names)"] = Object.keys(headers).sort().join(", ");
  return kept;
}

function fileName(url: string) {
  const { pathname, search } = new URL(url);
  const name = `${pathname}${search}`.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
  return name || "home";
}

async function visit(page: Page, url: string) {
  const exchanges: Exchange[] = [];
  const pending: Promise<void>[] = [];

  page.on("response", (response) => {
    const request = response.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) return;
    pending.push(
      (async () => {
        const contentType = response.headers()["content-type"] ?? "";
        let body: unknown;
        try {
          body = contentType.includes("json") ? summarize(await response.json()) : (await response.text()).slice(0, 2000);
        } catch (error) {
          body = `unreadable: ${(error as Error).message}`;
        }
        exchanges.push({
          method: request.method(),
          url: request.url(),
          headers: keepHeaders(await request.allHeaders()),
          body: parseMaybeJson(request.postData()),
          status: response.status(),
          contentType,
          response: body,
        });
      })(),
    );
  });

  let status: number | undefined;
  try {
    status = (await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 }))?.status();
  } catch (error) {
    console.warn(`  ${url}: ${(error as Error).message.split("\n")[0]}`);
  }
  // Scroll once so lazily loaded sections request their data too.
  await page
    .evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    })
    .catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await sleep(1500);
  await Promise.allSettled(pending);

  const links = await page
    .$$eval("a[href]", (anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href))
    .catch(() => [] as string[]);
  const text = await page
    .evaluate(() => document.body.innerText.slice(0, 4000))
    .catch(() => "");
  return { status, finalUrl: page.url(), exchanges, links: [...new Set(links)], text };
}

async function main() {
  const options = await readOptions();
  const maxPages = options.maxPages ?? 10;
  const follow = options.follow ?? ["academy"];
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.PW_EXECUTABLE_PATH || undefined });
  // Identify ourselves the same way the importer does, on top of the browser's own user agent.
  const probe = await browser.newPage();
  const userAgent = `${await probe.evaluate(() => navigator.userAgent)} MetapickMLBB-Inspector/1.0 (+https://metapick-mlbb.vercel.app; personal non-commercial project)`;
  await probe.close();
  const context = await browser.newContext({ userAgent, locale: "en-US", viewport: { width: 1366, height: 900 } });
  await context.route("**/*", (route) =>
    ["image", "media", "font"].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );

  const queue = (options.pages ?? ["/academy"]).map((page) => new URL(page, SITE).toString());
  const seen = new Set(queue);
  const summary: { url: string; finalUrl: string; status?: number; apiCalls: number; file: string }[] = [];

  while (queue.length > 0 && summary.length < maxPages) {
    const url = queue.shift()!;
    const page = await context.newPage();
    console.log(`open ${url}`);
    const result = await visit(page, url);
    const file = `${fileName(url)}.json`;
    await writeFile(path.join(outDir, file), `${JSON.stringify({ url, ...result }, null, 2)}\n`);
    await page.screenshot({ path: path.join(outDir, file.replace(/\.json$/, ".jpg")), type: "jpeg", quality: 45 });
    await page.close();
    summary.push({ url, finalUrl: result.finalUrl, status: result.status, apiCalls: result.exchanges.length, file });
    console.log(`  ${result.exchanges.length} API calls, ${result.links.length} links`);

    for (const link of result.links) {
      try {
        const target = new URL(link);
        target.hash = "";
        if (target.origin !== new URL(SITE).origin) continue;
        if (!follow.some((part) => target.pathname.includes(part) || target.search.includes(part))) continue;
        const key = target.toString();
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(key);
        }
      } catch {
        // not a URL
      }
    }
    await sleep(3000);
  }

  await writeFile(
    path.join(outDir, "_summary.json"),
    `${JSON.stringify({ userAgent, pages: summary, notOpened: queue }, null, 2)}\n`,
  );
  await browser.close();
  console.log(`done: ${summary.length} pages`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
