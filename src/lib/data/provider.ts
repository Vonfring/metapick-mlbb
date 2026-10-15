import type {
  BattleSpellRow,
  EmblemRow,
  EmblemTalentRow,
  HeroRelationRow,
  HeroRow,
  HeroSkillRow,
  HeroStatRow,
  HeroTagRow,
  ItemRow,
  PairRow,
} from "@/types/data";
import type { PeriodDays, RankBracket } from "@/types/domain";
import type { DataSourceKind } from "./config";

export type HeroDetails = {
  hero: HeroRow;
  skills: HeroSkillRow[];
  relations: HeroRelationRow[];
  /** Curated composition tags, when the hero has them. */
  tags: HeroTagRow | null;
};

/** Which published snapshot a set of numbers comes from. */
export type SnapshotInfo = {
  rank_bracket: RankBracket;
  period_days: PeriodDays;
  snapshot_date: string;
  fetched_at: string;
};

/** Win, pick and ban rates from the newest published snapshot for one rank and period. */
export type StatsSnapshot = SnapshotInfo & { stats: HeroStatRow[] };

/** Matchups and synergies from the same snapshot. Empty for periods without pair data (see MATCHUP_PERIOD). */
export type PairsSnapshot = SnapshotInfo & {
  matchups: PairRow[];
  synergies: PairRow[];
};

export type EmblemCatalog = {
  emblems: EmblemRow[];
  talents: EmblemTalentRow[];
};

/** Read-only access to game data. Both sources return the same row shapes. */
export type GameDataProvider = {
  kind: DataSourceKind;
  /** Active heroes, sorted by name. */
  listHeroes(): Promise<HeroRow[]>;
  getHeroDetails(slug: string): Promise<HeroDetails | null>;
  getStats(
    bracket: RankBracket,
    period: PeriodDays,
  ): Promise<StatsSnapshot | null>;
  getPairs(
    bracket: RankBracket,
    period: PeriodDays,
  ): Promise<PairsSnapshot | null>;
  listItems(): Promise<ItemRow[]>;
  getEmblemCatalog(): Promise<EmblemCatalog>;
  listSpells(): Promise<BattleSpellRow[]>;
  /** fetched_at of the newest published stats snapshot, or null if there is none. */
  getLastUpdate(): Promise<string | null>;
};
