import type { EmblemRow, EmblemTalentRow } from "@/types/data";
import type { HeroRole } from "@/types/domain";
import { splitCooldown, splitSummary } from "./text";

/** Basic Common: every set can also take its talents. */
export const SHARED_EMBLEM_SLUG = "basic-common";

export const talentTierLabels: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Core",
};

export type TalentView = {
  id: number;
  name: string;
  tier: number;
  /** The set that offers it, or null when every set can take it. */
  setId: number | null;
  setName: string | null;
  /** One-line summary that opens most tier 2 and core talents. */
  summary: string | null;
  text: string;
  cooldown: string | null;
};

/** Talents in catalog order, with the shared set's talents marked as open to every set. */
export function toTalentViews(
  emblems: EmblemRow[],
  talents: EmblemTalentRow[],
): TalentView[] {
  const shared = emblems.find((set) => set.slug === SHARED_EMBLEM_SLUG);
  const names = new Map(emblems.map((set) => [set.id, set.name]));
  return [...talents]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((talent) => {
      const { text: body, cooldown } = splitCooldown(talent.description);
      const { summary, text } = splitSummary(body);
      const setId =
        talent.emblem_id === null || talent.emblem_id === shared?.id
          ? null
          : talent.emblem_id;
      return {
        id: talent.id,
        name: talent.name,
        tier: talent.tier,
        setId,
        setName: setId === null ? null : (names.get(setId) ?? null),
        summary,
        text,
        cooldown,
      };
    });
}

/** The set made for a role (the curated recommendation until build data returns). */
export function setForRole<T extends Pick<EmblemRow, "recommended_roles">>(
  sets: T[],
  role: HeroRole,
): T | undefined {
  return sets.find((set) => set.recommended_roles.includes(role));
}
