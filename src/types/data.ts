// Row shapes shared by the seed files, the updater and the app's data layer.
// Field names match the database columns in supabase/migrations.

import type {
  DamageType,
  HeroLane,
  HeroRole,
  ItemCategory,
  PeriodDays,
  RankBracket,
} from "./domain";

export type HeroRow = {
  id: number;
  slug: string;
  name: string;
  roles: HeroRole[];
  lanes: HeroLane[];
  specialties: string[];
  durability: number | null;
  offense: number | null;
  control_effect: number | null;
  difficulty: number | null;
  lore: string | null;
  head_image_url: string | null;
  portrait_image_url: string | null;
  is_active?: boolean;
};

export type HeroSkillRow = {
  hero_id: number;
  slot: number;
  source_skill_id: number | null;
  name: string;
  description: string;
  cooldown: string | null;
  cost: string | null;
  tags: string[];
  icon_url: string | null;
};

export type HeroRelationKind =
  "best_teammate" | "strong_against" | "weak_against";

export type HeroRelationRow = {
  hero_id: number;
  relation: HeroRelationKind;
  target_hero_id: number;
  description: string | null;
};

/** Curated attributes, 0 to 3 each. Keyed by hero slug in seed/hero-tags.json. */
export type HeroTagValues = {
  damage_type: DamageType;
  frontline: number;
  hard_cc: number;
  peel: number;
  aoe_damage: number;
  pickoff: number;
  push: number;
  mobility: number;
  sustain: number;
  burst: number;
  scaling: number;
  needs_review?: boolean;
  notes?: string | null;
};

export type HeroTagRow = HeroTagValues & { hero_id: number };

export type LabeledValue = { label: string; value: string };
export type NamedText = { name: string; description: string };

export type ItemRow = {
  id: number;
  slug: string;
  name: string;
  category: ItemCategory;
  tier: number | null;
  price: number | null;
  attributes: LabeledValue[];
  passives: NamedText[];
  builds_into: number[];
  icon_url: string | null;
  is_active?: boolean;
};

export type EmblemRow = {
  id: number;
  slug: string;
  name: string;
  attributes: LabeledValue[];
  icon_url: string | null;
  recommended_roles: HeroRole[];
  sort_order: number;
};

export type EmblemTalentRow = {
  id: number;
  name: string;
  tier: number;
  description: string;
  icon_url: string | null;
  sort_order: number;
};

export type BattleSpellRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  short_description: string | null;
  icon_url: string | null;
  sort_order: number;
};

export type HeroStatRow = {
  hero_id: number;
  win_rate: number;
  pick_rate: number;
  ban_rate: number;
};

export type PairRow = {
  hero_id: number;
  other_id: number;
  win_rate_delta: number;
  other_win_rate: number | null;
};

export type StatSnapshotRecord = {
  rank_bracket: RankBracket;
  period_days: PeriodDays;
  snapshot_date: string;
  fetched_at: string;
  content_hash: string;
  stats: HeroStatRow[];
  /** Present only for the periods the updater stores matchups for. */
  matchups?: PairRow[];
  synergies?: PairRow[];
};

export type RecommendedBuildRecord = {
  hero_id: number;
  lane: HeroLane;
  rank_bracket: RankBracket;
  build_rank: number;
  emblem_id: number | null;
  talent_t1_id: number | null;
  talent_t2_id: number | null;
  talent_t3_id: number | null;
  battle_spell_id: number | null;
  pick_rate: number | null;
  win_rate: number | null;
  item_ids: number[];
};

/** Everything the official snapshot provides, as stored in seed/official/. */
export type OfficialSnapshot = {
  fetched_at: string;
  heroes: HeroRow[];
  skills: HeroSkillRow[];
  relations: HeroRelationRow[];
  items: ItemRow[];
  emblems: EmblemRow[];
  talents: EmblemTalentRow[];
  spells: BattleSpellRow[];
  builds: RecommendedBuildRecord[];
  snapshots: StatSnapshotRecord[];
};
