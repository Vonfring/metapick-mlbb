/** What one updater run did, and how it is reported (log row, job summary, exit code). */

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export type JobName = "stats" | "catalog";
export type RunStatus = "success" | "partial" | "failed" | "skipped";
export type Outcome = "written" | "unchanged" | "skipped";

export type ReportEntry = {
  /** "mythic/7d" for a snapshot, "items" or "hero 12" for catalog rows. */
  key: string;
  outcome: Outcome;
  rows?: number;
  reason?: string;
};

export type Revalidation =
  "done" | "no-changes" | "not-configured" | "failed" | "dry-run";

export type JobReport = {
  job: JobName;
  dryRun: boolean;
  startedAt: string;
  entries: ReportEntry[];
  warnings: string[];
  /** The source firewall stopped the run. */
  blocked: boolean;
  /** An error that ended the run early. */
  fatal: string | null;
  requests: number;
  retries: number;
  cacheHits: number;
  revalidation: Revalidation | null;
  pruned: Record<string, number> | null;
};

export function newReport(
  job: JobName,
  dryRun: boolean,
  startedAt: string,
): JobReport {
  return {
    job,
    dryRun,
    startedAt,
    entries: [],
    warnings: [],
    blocked: false,
    fatal: null,
    requests: 0,
    retries: 0,
    cacheHits: 0,
    revalidation: null,
    pruned: null,
  };
}

export function rowsWritten(report: JobReport): number {
  return report.entries.reduce(
    (sum, e) => sum + (e.outcome === "written" ? (e.rows ?? 0) : 0),
    0,
  );
}

const count = (report: JobReport, outcome: Outcome) =>
  report.entries.filter((e) => e.outcome === outcome).length;

/** The status stored in data_update_logs (see docs/activity-updater.md). */
export function runStatus(report: JobReport): RunStatus {
  const written = count(report, "written");
  const unchanged = count(report, "unchanged");
  const skipped = count(report, "skipped");
  if (report.fatal) return written > 0 ? "partial" : "failed";
  if (report.blocked) return written > 0 ? "partial" : "failed";
  if (skipped > 0) return written + unchanged > 0 ? "partial" : "failed";
  if (written === 0) return "skipped";
  return "success";
}

/** A run ends red, so GitHub emails the owner, when it failed or the firewall stopped it. */
export function exitCode(report: JobReport): 0 | 1 {
  return report.blocked ||
    report.fatal !== null ||
    runStatus(report) === "failed"
    ? 1
    : 0;
}

/** One line for the log row's message column. Never includes secrets. */
export function logMessage(report: JobReport): string {
  const parts = [
    `${count(report, "written")} written`,
    `${count(report, "unchanged")} unchanged`,
    `${count(report, "skipped")} skipped`,
  ];
  if (report.blocked) parts.push("stopped by the source firewall");
  if (report.fatal) parts.push(`error: ${report.fatal}`);
  return parts.join(", ");
}

const cell = (text: string) =>
  text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** Markdown for the GitHub job summary. */
export function renderSummary(report: JobReport): string {
  const status = runStatus(report);
  const title = report.job === "stats" ? "Statistics update" : "Catalog update";
  const lines = [
    `## ${title}: ${status}${report.dryRun ? " (dry run, nothing written)" : ""}`,
    "",
    `${logMessage(report)}. ${rowsWritten(report)} rows ${report.dryRun ? "would be written" : "written"}.`,
    `${report.requests} requests, ${report.retries} retries, ${report.cacheHits} answered from the cache.`,
  ];
  if (report.revalidation) {
    const text: Record<Revalidation, string> = {
      done: "The site was asked to refresh its pages.",
      "no-changes": "Nothing to show, so the site was not asked to refresh.",
      "not-configured":
        "SITE_URL or REVALIDATE_SECRET is not set, so the site refreshes on its own schedule.",
      failed:
        "Asking the site to refresh failed; it refreshes on its own schedule within 6 hours.",
      "dry-run": "Dry run: the site was not asked to refresh.",
    };
    lines.push(text[report.revalidation]);
  }
  if (report.pruned) {
    const pruned = Object.entries(report.pruned).map(
      ([what, n]) => `${n} ${what}`,
    );
    lines.push(`Pruned: ${pruned.join(", ")}.`);
  }
  if (report.entries.length > 0) {
    lines.push(
      "",
      "| Item | Result | Rows | Note |",
      "| --- | --- | ---: | --- |",
    );
    for (const e of report.entries) {
      lines.push(
        `| ${cell(e.key)} | ${e.outcome} | ${e.rows ?? ""} | ${cell(e.reason ?? "")} |`,
      );
    }
  }
  if (report.warnings.length > 0) {
    lines.push(
      "",
      "### Warnings",
      "",
      ...report.warnings.map((w) => `- ${cell(w)}`),
    );
  }
  return `${lines.join("\n")}\n`;
}
