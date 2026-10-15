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
  /** Curated composition tags of every hero that has them. */
  listHeroTags(): Promise<HeroTagRow[]>;
  /** Every official note (strong against, weak against, best teammate). */
  listRelations(): Promise<HeroRelationRow[]>;
  /** The newest snapshot, or the newest one dated on or before `onOrBefore` (YYYY-MM-DD). */
  getStats(
    bracket: RankBracket,
    period: PeriodDays,
    onOrBefore?: string,
  ): Promise<StatsSnapshot | null>;
  getPairs(
    bracket: RankBracket,
    period: PeriodDays,
  ): Promise<PairsSnapshot | null>;
  listItems(): Promise<ItemRow[]>;
  getEmblemCatalog(): Promise<EmblemCatalog>;
  listSpells(): Promise<BattleSpellRow[]>;
  /**
   * When the statistics were last checked: the end of the last stats run that
   * reached the source (even when nothing changed), else the newest snapshot's
   * fetch time, else null.
   */
  getLastUpdate(): Promise<string | null>;
};
