// Core domain vocabulary. Mirrors the Postgres enums in supabase/migrations.

export const HERO_ROLES = [
  "tank",
  "fighter",
  "assassin",
  "mage",
  "marksman",
  "support",
] as const;
export type HeroRole = (typeof HERO_ROLES)[number];

export const HERO_LANES = ["exp", "mid", "roam", "jungle", "gold"] as const;
export type HeroLane = (typeof HERO_LANES)[number];

export const RANK_BRACKETS = [
  "all",
  "epic",
  "legend",
  "mythic",
  "honor",
  "glory",
] as const;
export type RankBracket = (typeof RANK_BRACKETS)[number];

export const PERIODS = [1, 3, 7, 15, 30] as const;
export type PeriodDays = (typeof PERIODS)[number];

export const TIERS = ["SS", "S", "A", "B", "C", "D"] as const;
export type Tier = (typeof TIERS)[number];

export const DAMAGE_TYPES = ["physical", "magic", "mixed"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const ITEM_CATEGORIES = [
  "attack",
  "magic",
  "defense",
  "movement",
  "jungle",
  "roam",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const roleLabels: Record<HeroRole, string> = {
  tank: "Tank",
  fighter: "Fighter",
  assassin: "Assassin",
  mage: "Mage",
  marksman: "Marksman",
  support: "Support",
};

export const laneLabels: Record<HeroLane, string> = {
  exp: "EXP lane",
  mid: "Mid lane",
  roam: "Roam",
  jungle: "Jungle",
  gold: "Gold lane",
};

export const bracketLabels: Record<RankBracket, string> = {
  all: "All ranks",
  epic: "Epic",
  legend: "Legend",
  mythic: "Mythic",
  honor: "Mythic Honor",
  glory: "Mythic Glory",
};

export const periodLabels: Record<PeriodDays, string> = {
  1: "Last day",
  3: "Last 3 days",
  7: "Last 7 days",
  15: "Last 15 days",
  30: "Last 30 days",
};
