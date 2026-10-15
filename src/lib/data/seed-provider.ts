import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { compareNames } from "@/lib/format";
import type { HeroTagRow, ItemRow, StatSnapshotRecord } from "@/types/data";
import type { PeriodDays, RankBracket } from "@/types/domain";
import type { GameDataProvider, SnapshotInfo } from "./provider";
import {
  battleSpellRowSchema,
  emblemRowSchema,
  emblemTalentRowSchema,
  heroRelationRowSchema,
  heroRowSchema,
  heroSkillRowSchema,
  heroTagsFileSchema,
  itemOverridesFileSchema,
  itemRowSchema,
  statSnapshotRecordSchema,
} from "./schemas";

const SEED_DIR = path.join(process.cwd(), "seed");

/**
 * Parsed seed files, read once per server process. They only change between
 * builds; after editing one during `pnpm dev`, restart the dev server.
 */
const memo = new Map<string, Promise<unknown>>();

/** One seed file; a missing file means "no data yet" rather than an error. */
function readSeed<S extends z.ZodType>(
  file: string,
  schema: S,
  missing: z.infer<S>,
): Promise<z.infer<S>> {
  let pending = memo.get(file) as Promise<z.infer<S>> | undefined;
  if (!pending) {
    pending = readFile(path.join(SEED_DIR, file), "utf8").then(
      (text) => schema.parse(JSON.parse(text)),
      () => missing,
    );
    memo.set(file, pending);
  }
  return pending;
}

const heroes = () =>
  readSeed("official/heroes.json", z.array(heroRowSchema), []);
const skills = () =>
  readSeed("official/skills.json", z.array(heroSkillRowSchema), []);
const relations = () =>
  readSeed("official/relations.json", z.array(heroRelationRowSchema), []);
const snapshots = () =>
  readSeed("official/stats.json", z.array(statSnapshotRecordSchema), []);
const tagsFile = () => readSeed("hero-tags.json", heroTagsFileSchema, {});
const items = () =>
  readSeed("liquipedia/items.json", z.array(itemRowSchema), []);
const itemOverrides = () =>
  readSeed("overrides/items.json", itemOverridesFileSchema, {});
const emblems = () =>
  readSeed("liquipedia/emblems.json", z.array(emblemRowSchema), []);
const talents = () =>
  readSeed("liquipedia/talents.json", z.array(emblemTalentRowSchema), []);
const spells = () =>
  readSeed("liquipedia/spells.json", z.array(battleSpellRowSchema), []);

async function newestSnapshot(
  bracket: RankBracket,
  period: PeriodDays,
  onOrBefore?: string,
) {
  let newest: StatSnapshotRecord | undefined;
  for (const record of await snapshots()) {
    if (record.rank_bracket !== bracket || record.period_days !== period)
      continue;
    if (onOrBefore && record.snapshot_date > onOrBefore) continue;
    if (!newest || record.snapshot_date > newest.snapshot_date) newest = record;
  }
  return newest;
}

function snapshotInfo(record: StatSnapshotRecord): SnapshotInfo {
  const { rank_bracket, period_days, snapshot_date, fetched_at } = record;
  return { rank_bracket, period_days, snapshot_date, fetched_at };
}

export function createSeedProvider(): GameDataProvider {
  return {
    kind: "seed",
    async listHeroes() {
      return (await heroes())
        .filter((hero) => hero.is_active !== false)
        .sort((a, b) => compareNames(a.name, b.name));
    },
    async getHeroDetails(slug) {
      const hero = (await heroes()).find(
        (h) => h.slug === slug && h.is_active !== false,
      );
      if (!hero) return null;
      const values = (await tagsFile())[slug];
      const tags: HeroTagRow | null = values
        ? {
            ...values,
            hero_id: hero.id,
            needs_review: values.needs_review ?? false,
            notes: values.notes ?? null,
          }
        : null;
      return {
        hero,
        skills: (await skills())
          .filter((s) => s.hero_id === hero.id)
          .sort((a, b) => a.slot - b.slot),
        relations: (await relations()).filter((r) => r.hero_id === hero.id),
        tags,
      };
    },
    async getStats(bracket, period, onOrBefore) {
      const newest = await newestSnapshot(bracket, period, onOrBefore);
      return newest ? { ...snapshotInfo(newest), stats: newest.stats } : null;
    },
    async getPairs(bracket, period) {
      const newest = await newestSnapshot(bracket, period);
      return newest
        ? {
            ...snapshotInfo(newest),
            matchups: newest.matchups ?? [],
            synergies: newest.synergies ?? [],
          }
        : null;
    },
    async listItems() {
      // The same corrections seed.sql applies to the database.
      const overrides = await itemOverrides();
      return (await items())
        .map((item): ItemRow => ({ ...item, ...overrides[item.slug] }))
        .filter((item) => item.is_active !== false);
    },
    async getEmblemCatalog() {
      return {
        emblems: [...(await emblems())].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
        talents: [...(await talents())].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      };
    },
    async listSpells() {
      return [...(await spells())].sort((a, b) => a.sort_order - b.sort_order);
    },
    async getLastUpdate() {
      return (await snapshots()).reduce<string | null>(
        (latest, s) =>
          latest === null || s.fetched_at > latest ? s.fetched_at : latest,
        null,
      );
    },
  };
}
