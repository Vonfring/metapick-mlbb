"use client";

import { ChipGroup, type ChipOption } from "@/components/ui/chip-group";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { oneOf, useUrlParams } from "@/lib/use-url-params";
import {
  bracketLabels,
  HERO_LANES,
  HERO_ROLES,
  type HeroLane,
  type HeroRole,
  laneLabels,
  PERIODS,
  type PeriodDays,
  periodLabels,
  RANK_BRACKETS,
  type RankBracket,
  roleLabels,
} from "@/types/domain";

export type MetaFilterState = {
  bracket: RankBracket;
  period: PeriodDays;
  role: HeroRole | "all";
  lane: HeroLane | "all";
};

/** Rank, period, role and lane, kept in the URL. */
export function useMetaFilters() {
  const [params, setParams] = useUrlParams();
  // "all" is a real rank here (All ranks), so oneOf's "all" fallback can't be used.
  const rank = params.get("rank");
  const periodValue = Number(params.get("period"));
  const state: MetaFilterState = {
    bracket:
      rank && (RANK_BRACKETS as readonly string[]).includes(rank)
        ? (rank as RankBracket)
        : DEFAULT_BRACKET,
    period: (PERIODS as readonly number[]).includes(periodValue)
      ? (periodValue as PeriodDays)
      : DEFAULT_PERIOD,
    role: oneOf<HeroRole>(params.get("role"), HERO_ROLES),
    lane: oneOf<HeroLane>(params.get("lane"), HERO_LANES),
  };
  return { state, params, setParams };
}

const selectClass =
  "h-10 w-full rounded-md border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function MetaFilters({
  state,
  setParams,
}: {
  state: MetaFilterState;
  setParams: (next: Record<string, string | null>) => void;
}) {
  const roleOptions: ChipOption<HeroRole | "all">[] = [
    { value: "all", label: "All roles" },
    ...HERO_ROLES.map((r) => ({ value: r, label: roleLabels[r] })),
  ];
  const laneOptions: ChipOption<HeroLane | "all">[] = [
    { value: "all", label: "All lanes" },
    ...HERO_LANES.map((l) => ({ value: l, label: laneLabels[l] })),
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:max-w-md">
        <label className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-1">
          Rank
          <select
            className={selectClass}
            value={state.bracket}
            onChange={(e) =>
              setParams({
                rank:
                  e.target.value === DEFAULT_BRACKET ? null : e.target.value,
              })
            }
          >
            {RANK_BRACKETS.map((b) => (
              <option key={b} value={b}>
                {bracketLabels[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-1">
          Period
          <select
            className={selectClass}
            value={state.period}
            onChange={(e) =>
              setParams({
                period:
                  Number(e.target.value) === DEFAULT_PERIOD
                    ? null
                    : e.target.value,
              })
            }
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {periodLabels[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ChipGroup
        label="Role"
        options={roleOptions}
        value={state.role}
        onChange={(value) =>
          setParams({ role: value === "all" ? null : value })
        }
      />
      <ChipGroup
        label="Lane"
        options={laneOptions}
        value={state.lane}
        onChange={(value) =>
          setParams({ lane: value === "all" ? null : value })
        }
      />
    </div>
  );
}
