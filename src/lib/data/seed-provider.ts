import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { GameDataProvider } from "./provider";
import { heroRowSchema, statSnapshotRecordSchema } from "./schemas";

const OFFICIAL_DIR = path.join(process.cwd(), "seed", "official");

/** Reads one seed file; a missing file means "no data yet" rather than an error. */
async function readSeedFile<S extends z.ZodType>(
  file: string,
  schema: S,
): Promise<z.infer<S> | null> {
  let text: string;
  try {
    text = await readFile(path.join(OFFICIAL_DIR, file), "utf8");
  } catch {
    return null;
  }
  return schema.parse(JSON.parse(text));
}

export function createSeedProvider(): GameDataProvider {
  return {
    kind: "seed",
    async listHeroes() {
      const heroes =
        (await readSeedFile("heroes.json", z.array(heroRowSchema))) ?? [];
      return heroes
        .filter((hero) => hero.is_active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async getLastUpdate() {
      const snapshots =
        (await readSeedFile(
          "stats.json",
          z.array(statSnapshotRecordSchema.pick({ fetched_at: true })),
        )) ?? [];
      return snapshots.reduce<string | null>(
        (latest, s) =>
          latest === null || s.fetched_at > latest ? s.fetched_at : latest,
        null,
      );
    },
  };
}
