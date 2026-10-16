"use client";

import { useMemo, useRef } from "react";
import { ArrowsLeftRightIcon, UsersFourIcon } from "@/components/icons";
import { EmptyState } from "@/components/meta/empty-state";
import { HeroAvatar } from "@/components/meta/hero-avatar";
import { RankSelect } from "@/components/meta/rank-select";
import { SnapshotNote } from "@/components/meta-stats/snapshot-note";
import { CompositionChecklist } from "@/components/tools/composition-checklist";
import { Points } from "@/components/tools/edge-reasons";
import { HeroPicker } from "@/components/tools/hero-picker";
import { HeroSlots } from "@/components/tools/hero-slots";
import { LaneFilter } from "@/components/tools/lane-filter";
import { FixList, PickSuggestionRow } from "@/components/tools/pick-suggestion";
import { StrengthCard } from "@/components/tools/strength";
import { useToolData } from "@/components/tools/use-tool-data";
import { Button } from "@/components/ui/button";
import { DEFAULT_BRACKET } from "@/config/filters";
import type { HeroKnowledge, HeroSummary, MatchupSnapshot } from "@/lib/data";
import { heroListParam, parseHeroList } from "@/lib/hero-list-param";
import { TEAM_SIZE } from "@/lib/scoring/composition";
import { suggestPicks, suggestSwaps, teamStrength } from "@/lib/scoring/draft";
import { rankParam, useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";
import { bracketLabels } from "@/types/domain";

/** Team composition: one team's checklist, strength and fixes. State lives in the URL. */
export function TeamCompositionView({
  heroes,
  knowledge,
  initial,
}: {
  heroes: HeroSummary[];
  knowledge: HeroKnowledge;
  initial: MatchupSnapshot;
}) {
  const [params, setParams] = useUrlParams();
  const bracket = rankParam(params.get("rank"));
  const openLanesOnly = params.get("lanes") !== "any";
  const { bySlug, byId, allIds } = useMemo(
    () => ({
      bySlug: new Map(heroes.map((h) => [h.slug, h])),
      byId: new Map(heroes.map((h) => [h.id, h])),
      allIds: heroes.map((h) => h.id),
    }),
    [heroes],
  );
  const team = parseHeroList(params.get("team"), bySlug, TEAM_SIZE);
  const teamKey = team.map((h) => h.id).join(",");
  const { snapshot, index, popular, loading, error } = useToolData(
    heroes,
    knowledge,
    initial,
    bracket,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const nameOf = (id: number) => byId.get(id)?.name ?? "Unknown hero";
  const rankLabel = bracketLabels[snapshot.bracket];

  const setTeam = (next: HeroSummary[]) =>
    setParams({ team: heroListParam(next) });

  const { strength, suggestions, swaps } = useMemo(() => {
    const ids = teamKey ? teamKey.split(",").map(Number) : [];
    const full = ids.length >= TEAM_SIZE;
    return {
      strength: teamStrength(index, ids),
      suggestions: full
        ? []
        : suggestPicks(index, allIds, ids, [], new Set(ids), {
            openLanesOnly,
            rankBy: "composition",
          }),
      swaps: full ? suggestSwaps(index, ids, allIds) : [],
    };
  }, [teamKey, index, allIds, openLanesOnly]);
  const full = team.length >= TEAM_SIZE;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
      <section
        aria-labelledby="team-heading"
        className="flex flex-col gap-4 lg:sticky lg:top-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="team-heading" className="font-display text-lg font-semibold">
            Your team
          </h2>
          {team.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setTeam([])}>
              Clear
            </Button>
          ) : null}
        </div>
        <HeroSlots
          heroes={team}
          size={TEAM_SIZE}
          side="ally"
          teamName="your team"
          onRemove={(hero) => setTeam(team.filter((h) => h !== hero))}
          onEmpty={() => searchRef.current?.focus()}
        />
        <HeroPicker
          inputRef={searchRef}
          heroes={popular}
          taken={new Set(team.map((h) => h.id))}
          onPick={(hero) => setTeam([...team, hero])}
          placeholder="Search heroes"
          caption={`Most picked in ${rankLabel} first.`}
          actionLabel={(name) => `Add ${name} to your team`}
          blocked={
            full ? "The team is full. Tap a hero above to remove it." : null
          }
        />
      </section>

      <section aria-label="Result" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <RankSelect
            className="sm:max-w-56"
            value={bracket}
            onChange={(next) =>
              setParams({ rank: next === DEFAULT_BRACKET ? null : next })
            }
          />
          <SnapshotNote data={snapshot} loading={loading} error={error} />
        </div>

        {team.length === 0 ? (
          <EmptyState
            icon={UsersFourIcon}
            title="Add your first hero"
            description="Pick up to five heroes. The checklist shows what the lineup has and lacks, and the suggestions show which heroes fill the gaps."
          />
        ) : (
          <div
            aria-busy={loading}
            className={cn(
              "flex flex-col gap-6 transition-opacity",
              loading && "opacity-60",
            )}
          >
            <div className="grid gap-4 md:grid-cols-2 md:items-start">
              <section
                aria-labelledby="checklist-heading"
                className="flex flex-col gap-3 rounded-lg border bg-surface p-4"
              >
                <h3 id="checklist-heading" className="font-medium">
                  Checklist{full ? "" : ` for ${team.length} of ${TEAM_SIZE}`}
                </h3>
                <CompositionChecklist
                  report={strength!.report}
                  nameOf={nameOf}
                  showHints
                />
              </section>
              <StrengthCard strength={strength} />
            </div>

            {full ? (
              <section
                aria-labelledby="swaps-heading"
                className="flex flex-col gap-3"
              >
                <h3
                  id="swaps-heading"
                  className="font-display text-lg font-semibold"
                >
                  Swaps that help
                </h3>
                {swaps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No single swap improves the checklist.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {swaps.map((swap) => {
                      const out = byId.get(swap.out)!;
                      const into = byId.get(swap.in)!;
                      return (
                        <li
                          key={`${swap.out}-${swap.in}`}
                          className="flex flex-col gap-2 rounded-lg border bg-surface p-3 sm:flex-row sm:items-center"
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <HeroAvatar
                              name={out.name}
                              src={out.head_image_url}
                              size="xs"
                              decorative
                            />
                            <ArrowsLeftRightIcon
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <HeroAvatar
                              name={into.name}
                              src={into.head_image_url}
                              size="xs"
                              decorative
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                Swap {out.name} for {into.name}
                              </span>
                              <FixList fixes={swap.fixes} />
                            </span>
                          </span>
                          <span className="flex items-center justify-between gap-3 sm:justify-end">
                            <Points value={swap.gain} />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setTeam(team.map((h) => (h === out ? into : h)))
                              }
                            >
                              Swap
                            </Button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : (
              <section
                aria-labelledby="fill-heading"
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3
                    id="fill-heading"
                    className="font-display text-lg font-semibold"
                  >
                    Heroes that fill the gaps
                  </h3>
                  <LaneFilter
                    openLanesOnly={openLanesOnly}
                    onChange={(open) =>
                      setParams({ lanes: open ? null : "any" })
                    }
                  />
                </div>
                <ol className="flex flex-col gap-2">
                  {suggestions.map((s, i) => {
                    const hero = byId.get(s.heroId);
                    if (!hero) return null;
                    return (
                      <PickSuggestionRow
                        key={s.heroId}
                        rank={i + 1}
                        suggestion={s}
                        hero={hero}
                        index={index}
                        nameOf={nameOf}
                        rankLabel={rankLabel}
                        action={
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Add ${hero.name} to your team`}
                            onClick={() => setTeam([...team, hero])}
                          >
                            Add
                          </Button>
                        }
                      />
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
