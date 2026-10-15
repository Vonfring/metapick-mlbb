import { Meter } from "@/components/stats/meter";
import { DRAFT_SCORING } from "@/config/draft-scoring";
import type { TeamStrength } from "@/lib/scoring/draft";
import { cn } from "@/lib/utils";

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** A team's strength, 0 to 100, with its three parts. */
export function StrengthCard({
  strength,
  title = "Team strength",
  className,
}: {
  strength: TeamStrength | null;
  title?: string;
  className?: string;
}) {
  const w = DRAFT_SCORING.strength;
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-surface p-4",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <span className="font-display text-3xl font-bold tabular-nums">
          {strength ? strength.total : "—"}
          <span className="text-base font-semibold text-muted-foreground">
            {" "}
            / 100
          </span>
        </span>
      </div>
      {strength ? (
        <div className="flex flex-col gap-3">
          <Meter
            label={`Composition (${w.composition} points)`}
            value={Math.round(strength.composition * 100)}
            display={percent(strength.composition)}
          />
          <Meter
            label={`Form (${w.form} points)`}
            value={Math.round(strength.form * 100)}
            display={percent(strength.form)}
          />
          <Meter
            label={`Synergy (${w.synergy} points)`}
            value={Math.round(strength.synergy * 100)}
            display={percent(strength.synergy)}
          />
          <p className="text-xs text-muted-foreground">
            Composition is the share of checks passed. Form is how the heroes
            rank by adjusted win rate among all heroes. Synergy starts at 50%
            and moves with the win rate changes between teammates.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a hero to see the score.
        </p>
      )}
    </section>
  );
}
