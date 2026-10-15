/**
 * The scheduled data updater (docs/activity-updater.md). Runs on GitHub
 * Actions, never on Vercel.
 *
 *   pnpm update:stats    [--dry-run] [--fresh] [--trigger schedule|manual]
 *   pnpm update:catalog  [--dry-run] [--fresh] [--trigger schedule|manual]
 *
 * --dry-run  fetch and check everything, write nothing
 * --fresh    ignore responses cached in .cache/ (20 hours)
 *
 * Environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to write (without
 * them the run is a dry run against the seed files), SITE_URL and
 * REVALIDATE_SECRET to refresh the site afterwards.
 */
import { appendFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  heroTagsFileSchema,
  itemOverridesFileSchema,
} from "@/lib/data/schemas";
import { createSourceClient } from "../source/client";
import { createLiquipediaClient } from "../source/liquipedia";
import { parseCatalog } from "../source/transform/liquipedia";
import { readJson, SEED_DIR } from "../seed/files";
import { runCatalogJob, syncHeroes, type CatalogDeps } from "./catalog-job";
import { fetchHeroCatalog, fetchRankedStats } from "./official";
import {
  exitCode,
  logMessage,
  newReport,
  renderSummary,
  rowsWritten,
  runStatus,
  type JobName,
} from "./report";
import { revalidateSite } from "./revalidate";
import { createSeedReader } from "./seed-reader";
import {
  createDryRunStore,
  createServiceClient,
  createSupabaseReader,
  createSupabaseStore,
  type UpdaterStore,
} from "./store";
import { runStatsJob } from "./stats-job";
import { downloadCatalog } from "./wiki";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const log = (message: string) => console.log(`  ${message}`);

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      fresh: { type: "boolean", default: false },
      trigger: { type: "string", default: "manual" },
    },
  });
  const job = positionals[0];
  if (job !== "stats" && job !== "catalog") {
    console.error(
      "Usage: tsx scripts/updater/run.ts <stats|catalog> [--dry-run] [--fresh] [--trigger schedule|manual]",
    );
    return 2;
  }

  const env = process.env;
  const fetchedAt = new Date().toISOString();
  let dryRun = values["dry-run"];
  let store: UpdaterStore;
  const notes: string[] = [];
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createServiceClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
    store = dryRun
      ? createDryRunStore(createSupabaseReader(db))
      : createSupabaseStore(db);
  } else {
    if (!dryRun)
      notes.push(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set, so this is a dry run.",
      );
    notes.push("Compared against the seed files instead of the database.");
    dryRun = true;
    store = createDryRunStore(createSeedReader());
  }

  const report = newReport(job satisfies JobName, dryRun, fetchedAt);
  const official = createSourceClient({
    cacheDir: values.fresh ? null : path.resolve(".cache", "source"),
    log,
  });
  const wiki = createLiquipediaClient({
    cacheDir: values.fresh ? null : path.resolve(".cache", "liquipedia"),
    log,
  });
  const runUrl = env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : null;

  let runId: number | null = null;
  try {
    const stale = await store.closeStaleRuns(2);
    if (stale > 0)
      report.warnings.push(
        `Closed ${stale} log rows that an earlier run left running.`,
      );
    runId = await store.startRun(
      job,
      values.trigger === "schedule" ? "schedule" : "manual",
      runUrl,
    );
  } catch (error) {
    report.fatal = `Could not reach the database: ${errorText(error)}`;
  }

  if (!report.fatal) {
    const catalogDeps: CatalogDeps = {
      store,
      report,
      fetchedAt,
      fetchHeroes: () => fetchHeroCatalog(official),
      fetchWiki: async () => parseCatalog(await downloadCatalog(wiki)),
      loadTags: () =>
        readJson(path.join(SEED_DIR, "hero-tags.json"), heroTagsFileSchema),
      loadItemOverrides: () =>
        readJson(
          path.join(SEED_DIR, "overrides", "items.json"),
          itemOverridesFileSchema,
        ),
    };
    try {
      if (job === "stats") {
        await runStatsJob({
          store,
          report,
          fetchedAt,
          runId,
          fetchStats: (bracket, period, pairs) =>
            fetchRankedStats(official, bracket, period, pairs),
          refreshHeroes: () => syncHeroes(catalogDeps),
        });
      } else {
        await runCatalogJob(catalogDeps);
      }
    } catch (error) {
      report.fatal = errorText(error);
    }
  }

  report.requests = official.stats.requests + wiki.stats.requests;
  report.retries = official.stats.retries + wiki.stats.retries;
  report.cacheHits = official.stats.cacheHits + wiki.stats.cacheHits;

  if (dryRun) report.revalidation = "dry-run";
  else if (rowsWritten(report) === 0) report.revalidation = "no-changes";
  else {
    const { result, detail } = await revalidateSite(
      env.SITE_URL,
      env.REVALIDATE_SECRET,
    );
    report.revalidation = result;
    if (detail) report.warnings.push(`Revalidation: ${detail}`);
  }

  try {
    await store.finishRun(runId, {
      status: runStatus(report),
      requests: report.requests,
      retries: report.retries,
      rowsWritten: rowsWritten(report),
      message: logMessage(report),
      details: {
        entries: report.entries,
        warnings: report.warnings,
        pruned: report.pruned,
        revalidation: report.revalidation,
      },
    });
  } catch (error) {
    report.warnings.push(
      `The log row could not be finished: ${errorText(error)}`,
    );
  }

  let summary = renderSummary(report);
  if (notes.length > 0) summary += `\n${notes.join(" ")}\n`;
  if (store.recorded.length > 0) {
    summary += `\n### Would write\n\n${store.recorded.map((line) => `- ${line}`).join("\n")}\n`;
  }
  console.log(`\n${summary}`);
  if (env.GITHUB_STEP_SUMMARY)
    await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  return exitCode(report);
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(errorText(error));
    process.exit(1);
  },
);
