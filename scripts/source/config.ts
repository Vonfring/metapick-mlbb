import type {
  HeroLane,
  HeroRole,
  PeriodDays,
  RankBracket,
} from "@/types/domain";

/**
 * Where the official data lives. The hero endpoints sit under one base path;
 * the "Academy" endpoints (items, emblems, spells, builds) use a second base
 * path that is confirmed on the first live request (see docs/activity-updater.md).
 */
export const SOURCE_BASE_URL =
  process.env.MLBB_SOURCE_BASE_URL ??
  "https://api.gms.moontontech.com/api/gms/source/2669606";
export const ACADEMY_BASE_URL = process.env.MLBB_ACADEMY_BASE_URL ?? "";

export const HERO_SOURCE_IDS = {
  heroList: 2756564,
  skillCombos: 2674711,
} as const;

/** Ranked statistics, one source per time period. */
export const STATS_SOURCE_IDS: Record<PeriodDays, number> = {
  1: 2756567,
  3: 2756568,
  7: 2756569,
  15: 2756565,
  30: 2756570,
};

export const TREND_SOURCE_IDS = {
  7: 2674709,
  15: 2687909,
  30: 2690860,
} as const;

export const ACADEMY_SOURCE_IDS = {
  posts: 2718124,
  heroes: 2766683,
  roles: 2740642,
  equipment: 2775075,
  equipmentExpanded: 2713995,
  spells: 2718122,
  emblems: 2718121,
  ranks: 3210596,
  heroStats: 2755183,
  builds: 2776688,
  matchups: 2777391,
} as const;

export const PATCH_NOTES_FORM_ID = 2777742;

export const RANK_CODES: Record<RankBracket, string> = {
  all: "101",
  epic: "5",
  legend: "6",
  mythic: "7",
  honor: "8",
  glory: "9",
};

export const ROLE_IDS: Record<HeroRole, number> = {
  tank: 1,
  fighter: 2,
  assassin: 3,
  mage: 4,
  marksman: 5,
  support: 6,
};

export const LANE_IDS: Record<HeroLane, number> = {
  exp: 1,
  mid: 2,
  roam: 3,
  jungle: 4,
  gold: 5,
};

/** match_type in the ranked statistics sources. */
export const MATCH_TYPE = { counters: "0", teammates: "1" } as const;

/** One honest, fixed User-Agent. No rotation, no spoofed forwarding headers. */
export const USER_AGENT =
  "MetapickMLBB-Updater/1.0 (+https://metapick-mlbb.vercel.app; personal non-commercial project)";

export const PACING = {
  /** Minimum gap between two requests. */
  minIntervalMs: 2_000,
  /** Random extra wait added to each gap. */
  jitterMs: 600,
  /** Retries for network errors and 5xx responses: 2s, 4s, 8s, 16s. */
  maxRetries: 4,
  backoffBaseMs: 2_000,
  /** One cool-down when the firewall blocks us; a second block stops the job. */
  blockCooldownMs: 60_000,
  timeoutMs: 30_000,
  /** Responses cached on disk are reused for this long (reruns on the same day). */
  cacheTtlMs: 20 * 60 * 60 * 1000,
} as const;
