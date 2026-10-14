import "server-only";

export type DataSourceKind = "seed" | "supabase";

/**
 * Where game data is read from on the server.
 * - "supabase": production. Reads with the publishable key; RLS makes it read-only.
 * - "seed": the JSON files in seed/. Used for local development and CI builds.
 * Defaults to "supabase" only when its credentials are present.
 */
export function getDataSourceKind(): DataSourceKind {
  const explicit = process.env.DATA_SOURCE;
  if (explicit === "seed" || explicit === "supabase") return explicit;
  return process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY
    ? "supabase"
    : "seed";
}

/** Tag on every cached read of game data; the updater revalidates it after each run. */
export const GAME_DATA_TAG = "game-data";
