import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { computeTiers } from "@/lib/scoring/tier";
import type { BattleSpellRow, HeroRow, ItemRow } from "@/types/data";
import type { PeriodDays, RankBracket, Tier } from "@/types/domain";
import { GAME_DATA_TAG, getDataSourceKind } from "./config";
import type {
  EmblemCatalog,
  GameDataProvider,
  HeroDetails,
  PairsSnapshot,
  SnapshotInfo,
  StatsSnapshot,
} from "./provider";
import { createSeedProvider } from "./seed-provider";
import { createSupabaseProvider } from "./supabase-provider";

export type {
  EmblemCatalog,
  HeroDetails,
  PairsSnapshot,
  SnapshotInfo,
  StatsSnapshot,
} from "./provider";

function provider(): GameDataProvider {
  return getDataSourceKind() === "supabase"
    ? createSupabaseProvider()
    : createSeedProvider();
}

// Every read is cached with the "gameData" profile (see next.config.ts) and
// tagged, so pages stay static until the updater asks for revalidation.

export async function getHeroes(): Promise<HeroRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listHeroes();
}

export async function getHeroDetails(
  slug: string,
): Promise<HeroDetails | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getHeroDetails(slug);
}

export async function getStatsSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<StatsSnapshot | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getStats(bracket, period);
}

export async function getPairsSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<PairsSnapshot | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getPairs(bracket, period);
}

export async function getItems(): Promise<ItemRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listItems();
}

export async function getEmblemCatalog(): Promise<EmblemCatalog> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getEmblemCatalog();
}

export async function getSpells(): Promise<BattleSpellRow[]> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().listSpells();
}

export async function getLastUpdate(): Promise<string | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getLastUpdate();
}

/** A hero with its rates and tier in one rank and period. Rates are null when the snapshot lacks the hero. */
export type RankedHero = Pick<
  HeroRow,
  "id" | "slug" | "name" | "roles" | "lanes" | "head_image_url"
> & {
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  tier: Tier | null;
  /** Tier score (higher is stronger), for sorting. Null when the hero has no tier. */
  score: number | null;
};

export type RankedHeroes = {
  heroes: RankedHero[];
  snapshot: SnapshotInfo | null;
};

export async function getRankedHeroes(
  bracket: RankBracket,
  period: PeriodDays,
): Promise<RankedHeroes> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  const [heroes, snapshot] = await Promise.all([
    getHeroes(),
    getStatsSnapshot(bracket, period),
  ]);
  const statsByHero = new Map(snapshot?.stats.map((s) => [s.hero_id, s]));
  const tiers = computeTiers(snapshot?.stats ?? []);
  return {
    heroes: heroes.map((hero) => {
      const stats = statsByHero.get(hero.id);
      const tier = tiers.get(hero.id);
      return {
        id: hero.id,
        slug: hero.slug,
        name: hero.name,
        roles: hero.roles,
        lanes: hero.lanes,
        head_image_url: hero.head_image_url,
        winRate: stats?.win_rate ?? null,
        pickRate: stats?.pick_rate ?? null,
        banRate: stats?.ban_rate ?? null,
        tier: tier?.tier ?? null,
        // Rarely picked heroes get no tier, so they sort after every tiered hero.
        score: tier?.tier ? tier.score : null,
      };
    }),
    snapshot: snapshot
      ? {
          rank_bracket: snapshot.rank_bracket,
          period_days: snapshot.period_days,
          snapshot_date: snapshot.snapshot_date,
          fetched_at: snapshot.fetched_at,
        }
      : null,
  };
}
