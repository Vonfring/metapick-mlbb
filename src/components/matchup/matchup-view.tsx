"use client";

import { useMemo } from "react";
import { RankSelect } from "@/components/meta/rank-select";
import { SnapshotNote } from "@/components/meta-stats/snapshot-note";
import { useToolData } from "@/components/tools/use-tool-data";
import { ChipGroup } from "@/components/ui/chip-group";
import { DEFAULT_BRACKET } from "@/config/filters";
import type { HeroKnowledge, HeroSummary, MatchupSnapshot } from "@/lib/data";
import type { HeroIndex } from "@/lib/scoring/hero-index";
import { rankParam, useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";
import type { RankBracket } from "@/types/domain";
import { HeroVsHero } from "./hero-vs-hero";
import { TeamVsTeam } from "./team-vs-team";

const MODES = [
  { value: "hero", label: "Hero against hero" },
  { value: "team", label: "Team against team" },
] as const;
type Mode = (typeof MODES)[number]["value"];

/** What both matchup modes read from. */
export type MatchupTools = {
  heroes: HeroSummary[];
  byId: ReadonlyMap<number, HeroSummary>;
  bySlug: ReadonlyMap<string, HeroSummary>;
  nameOf: (heroId: number) => string;
  index: HeroIndex;
  /** Most picked first, for the picker. */
  popular: HeroSummary[];
  /** The rank of the numbers on screen (the previous one while a new rank loads). */
  bracket: RankBracket;
  params: URLSearchParams;
  setParams: (next: Record<string, string | null>) => void;
};

/** Matchup: two heroes or two teams compared, with the reasons. State lives in the URL. */
export function MatchupView({
  heroes,
  knowledge,
  initial,
}: {
  heroes: HeroSummary[];
  knowledge: HeroKnowledge;
  initial: MatchupSnapshot;
}) {
  const [params, setParams] = useUrlParams();
  const mode: Mode = params.get("mode") === "team" ? "team" : "hero";
  const bracket = rankParam(params.get("rank"));
  const { snapshot, index, popular, loading, error } = useToolData(
    heroes,
    knowledge,
    initial,
    bracket,
  );
  const lookups = useMemo(() => {
    const byId = new Map(heroes.map((h) => [h.id, h]));
    return {
      byId,
      bySlug: new Map(heroes.map((h) => [h.slug, h])),
      nameOf: (id: number) => byId.get(id)?.name ?? "Unknown hero",
    };
  }, [heroes]);
  const tools: MatchupTools = {
    heroes,
    ...lookups,
    index,
    popular,
    bracket: snapshot.bracket,
    params,
    setParams,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ChipGroup
          label="Compare"
          options={MODES}
          value={mode}
          onChange={(value) =>
            setParams({ mode: value === "hero" ? null : value })
          }
        />
        <RankSelect
          className="sm:w-56"
          value={bracket}
          onChange={(next) =>
            setParams({ rank: next === DEFAULT_BRACKET ? null : next })
          }
        />
      </div>
      <SnapshotNote data={snapshot} loading={loading} error={error} />
      <div
        aria-busy={loading}
        className={cn("transition-opacity", loading && "opacity-60")}
      >
        {mode === "hero" ? (
          <HeroVsHero tools={tools} />
        ) : (
          <TeamVsTeam tools={tools} />
        )}
      </div>
    </div>
  );
}
