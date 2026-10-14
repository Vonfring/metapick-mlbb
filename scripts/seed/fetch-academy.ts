import type {
  BattleSpellRow,
  EmblemRow,
  EmblemTalentRow,
  HeroRow,
  ItemRow,
  RecommendedBuildRecord,
} from "@/types/data";
import type { SourceClient } from "../source/client";

export type AcademyData = {
  items: ItemRow[];
  emblems: EmblemRow[];
  talents: EmblemTalentRow[];
  spells: BattleSpellRow[];
  builds: RecommendedBuildRecord[];
};

/**
 * Items, emblems, talents, battle spells and recommended builds.
 * Written once the Academy responses have been inspected (their field names
 * are not confirmed yet), so calling it early fails loudly instead of
 * guessing.
 */
export async function fetchAcademy(
  _client: SourceClient,
  _baseUrl: string,
  _heroes: HeroRow[],
  _warnings: string[],
): Promise<AcademyData> {
  throw new Error("The Academy import is not written yet: inspect its responses first (pnpm seed:inspect).");
}
