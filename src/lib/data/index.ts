import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { HeroRow } from "@/types/data";
import { GAME_DATA_TAG, getDataSourceKind } from "./config";
import type { GameDataProvider } from "./provider";
import { createSeedProvider } from "./seed-provider";
import { createSupabaseProvider } from "./supabase-provider";

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

export async function getLastUpdate(): Promise<string | null> {
  "use cache";
  cacheLife("gameData");
  cacheTag(GAME_DATA_TAG);
  return provider().getLastUpdate();
}
