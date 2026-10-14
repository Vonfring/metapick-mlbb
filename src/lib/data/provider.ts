import type { HeroRow } from "@/types/data";
import type { DataSourceKind } from "./config";

/** Read-only access to game data. Both sources return the same row shapes. */
export type GameDataProvider = {
  kind: DataSourceKind;
  listHeroes(): Promise<HeroRow[]>;
  /** fetched_at of the newest published stats snapshot, or null if there is none. */
  getLastUpdate(): Promise<string | null>;
};
