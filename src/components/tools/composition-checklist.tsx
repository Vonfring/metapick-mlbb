import {
  CheckCircleIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@/components/icons";
import type {
  CheckResult,
  CheckStatus,
  CompositionReport,
} from "@/lib/scoring/composition";
import { cn } from "@/lib/utils";
import { laneLabels } from "@/types/domain";

const status: Record<
  CheckStatus,
  { icon: typeof CheckCircleIcon; label: string; className: string }
> = {
  ok: { icon: CheckCircleIcon, label: "OK", className: "text-positive" },
  weak: {
    icon: WarningCircleIcon,
    label: "Weak",
    className: "text-foreground",
  },
  missing: { icon: XCircleIcon, label: "Missing", className: "text-negative" },
};

const count = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function detail(check: CheckResult, complete: boolean): string {
  switch (check.kind) {
    case "tag":
      return `${check.total} (needs ${check.ok})`;
    case "lanes":
      return complete && check.open.length > 0
        ? `Open: ${check.open.map((l) => laneLabels[l]).join(", ")}`
        : `${check.covered} of ${check.needed} ${check.needed === 1 ? "hero gets its" : "heroes get their"} own lane`;
    case "damage":
      return `${count(check.physical)} physical, ${count(check.magic)} magic`;
  }
}

/** The composition checks for one team, each with its status as icon and word. */
export function CompositionChecklist({
  report,
  nameOf,
  showHints = false,
  className,
}: {
  report: CompositionReport;
  nameOf: (heroId: number) => string;
  /** Explain in plain words what each missing or weak check means. */
  showHints?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1.5">
        {report.checks.map((check) => {
          const s = status[check.status];
          const Icon = s.icon;
          return (
            <li
              key={check.id}
              className="grid grid-cols-[1.25rem_1fr] items-start gap-2 text-sm"
            >
              <Icon
                className={cn("mt-0.5 size-4", s.className)}
                weight="fill"
                aria-hidden
              />
              <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span>
                  <span className="font-medium">{check.label}</span>
                  {check.status === "ok" ? (
                    <span className="sr-only">: {s.label}.</span>
                  ) : (
                    <span
                      className={cn("ml-1.5 text-xs font-medium", s.className)}
                    >
                      {s.label}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {detail(check, report.complete)}
                </span>
                {/* A partial team misses most checks; only a lane clash
                    means something before the team is full. */}
                {showHints &&
                check.status !== "ok" &&
                (report.complete || check.kind === "lanes") ? (
                  <span className="basis-full pt-0.5 text-xs text-muted-foreground">
                    {check.hint}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {report.untagged.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No hero tags yet for {report.untagged.map(nameOf).join(", ")}, so the
          tag checks count{" "}
          {report.untagged.length === 1 ? "this hero" : "these heroes"} as zero.
        </p>
      ) : null}
    </div>
  );
}
