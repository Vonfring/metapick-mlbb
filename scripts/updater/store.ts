/**
 * Everything the updater reads from and writes to the database.
 *
 * - createSupabaseStore: the real database, with the service role key.
 * - createDryRunStore: reads from a reader (the database, or the seed files
 *   when there is no key) and only records what it would write.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BattleSpellRow,
  EmblemRow,
  EmblemTalentRow,
  HeroRelationRow,
  HeroRow,
  HeroSkillRow,
  HeroTagRow,
  ItemRow,
  PairRow,
  HeroStatRow,
} from "@/types/data";
import { selectAll } from "@/lib/data/paging";
import type { PeriodDays, RankBracket } from "@/types/domain";
import {
  oldestKeptDate,
  snapshotsToDelete,
  snapshotsToStripPairs,
  type SnapshotWithPairs,
} from "./prune";
import type { JobName, RunStatus } from "./report";

export type CatalogKind = "hero" | "item" | "emblem" | "talent" | "spell";
export type CatalogTable =
  "items" | "emblems" | "emblem_talents" | "battle_spells";
export type CatalogRowOf = {
  items: ItemRow;
  emblems: EmblemRow;
  emblem_talents: EmblemTalentRow;
  battle_spells: BattleSpellRow;
};

export type SnapshotPayload = {
  rank_bracket: RankBracket;
  period_days: PeriodDays;
  snapshot_date: string;
  fetched_at: string;
  content_hash: string;
  run_id: number | null;
  stats: HeroStatRow[];
  matchups: PairRow[];
  synergies: PairRow[];
};

export type HeroDetailsWrite = {
  heroId: number;
  skills: HeroSkillRow[];
  relations: HeroRelationRow[];
};

export type RunFields = {
  status: RunStatus;
  requests: number;
  retries: number;
  rowsWritten: number;
  message: string;
  details: unknown;
};

/** Reads only. Implemented by the database and by the seed files. */
export type StoreReader = {
  knownHeroIds(): Promise<Set<number>>;
  /** content_hash of the newest snapshot (published or not) per "rank/period", since a date. */
  latestSnapshotHashes(sinceDate: string): Promise<Map<string, string>>;
  sourceHashes(kind: CatalogKind): Promise<Map<string, string>>;
  activeIds(table: "heroes" | "items"): Promise<number[]>;
  allIds(table: Exclude<CatalogTable, "items">): Promise<number[]>;
  heroIdsWithTags(): Promise<Set<number>>;
};

export type UpdaterStore = StoreReader & {
  readonly dryRun: boolean;
  /** Writes recorded by a dry run, for the job summary. */
  readonly recorded: string[];
  startRun(
    job: JobName,
    triggeredBy: "schedule" | "manual",
    runUrl: string | null,
  ): Promise<number | null>;
  finishRun(id: number | null, fields: RunFields): Promise<void>;
  /** Closes log rows left "running" by a crashed run. Returns how many. */
  closeStaleRuns(olderThanHours: number): Promise<number>;
  writeSnapshot(payload: SnapshotPayload): Promise<void>;
  pruneStats(keepDays: number): Promise<Record<string, number>>;
  saveSourceHashes(
    kind: CatalogKind,
    entries: { id: string; hash: string }[],
  ): Promise<void>;
  dropSourceHashes(kind: CatalogKind, ids: string[]): Promise<void>;
  upsertHeroes(
    rows: (HeroRow & { source_updated_at: string })[],
  ): Promise<void>;
  replaceHeroDetails(writes: HeroDetailsWrite[]): Promise<void>;
  deactivate(table: "heroes" | "items", ids: number[]): Promise<void>;
  upsertCatalog<T extends CatalogTable>(
    table: T,
    rows: CatalogRowOf[T][],
  ): Promise<void>;
  deleteCatalog(
    table: Exclude<CatalogTable, "items">,
    ids: number[],
  ): Promise<void>;
  insertTags(rows: HeroTagRow[]): Promise<void>;
};

const key = (bracket: string, period: number) => `${bracket}/${period}d`;
export const snapshotKey = key;

/** Splits a list into slices, so no single request grows too large. */
function chunks<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function check<T>(
  what: string,
  result: { data: T; error: { message: string } | null },
): T {
  if (result.error)
    throw new Error(`Database ${what} failed: ${result.error.message}`);
  return result.data;
}

export function createServiceClient(
  url: string,
  serviceKey: string,
): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseReader(db: SupabaseClient): StoreReader {
  return {
    async knownHeroIds() {
      const rows = await selectAll<{ id: number }>("read heroes", (from, to) =>
        db.from("heroes").select("id").order("id").range(from, to),
      );
      return new Set(rows.map((r) => r.id));
    },
    async latestSnapshotHashes(sinceDate) {
      const rows = await selectAll<{
        rank_bracket: string;
        period_days: number;
        content_hash: string;
      }>("read snapshots", (from, to) =>
        db
          .from("stat_snapshots")
          .select("rank_bracket, period_days, content_hash")
          .gte("snapshot_date", sinceDate)
          .order("snapshot_date", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      );
      const latest = new Map<string, string>();
      for (const row of rows) {
        const k = key(row.rank_bracket, row.period_days);
        if (!latest.has(k)) latest.set(k, row.content_hash);
      }
      return latest;
    },
    async sourceHashes(kind) {
      const rows = await selectAll<{ source_id: string; hash: string }>(
        "read source hashes",
        (from, to) =>
          db
            .from("source_hashes")
            .select("source_id, hash")
            .eq("kind", kind)
            .order("source_id")
            .range(from, to),
      );
      return new Map(rows.map((r) => [r.source_id, r.hash]));
    },
    async activeIds(table) {
      const rows = await selectAll<{ id: number }>(
        `read ${table}`,
        (from, to) =>
          db
            .from(table)
            .select("id")
            .eq("is_active", true)
            .order("id")
            .range(from, to),
      );
      return rows.map((r) => r.id);
    },
    async allIds(table) {
      const rows = await selectAll<{ id: number }>(
        `read ${table}`,
        (from, to) => db.from(table).select("id").order("id").range(from, to),
      );
      return rows.map((r) => r.id);
    },
    async heroIdsWithTags() {
      const rows = await selectAll<{ hero_id: number }>(
        "read hero_tags",
        (from, to) =>
          db
            .from("hero_tags")
            .select("hero_id")
            .order("hero_id")
            .range(from, to),
      );
      return new Set(rows.map((r) => r.hero_id));
    },
  };
}

export function createSupabaseStore(db: SupabaseClient): UpdaterStore {
  return {
    ...createSupabaseReader(db),
    dryRun: false,
    recorded: [],
    async startRun(job, triggeredBy, runUrl) {
      const row = check(
        "start the log row",
        await db
          .from("data_update_logs")
          .insert({
            job,
            triggered_by: triggeredBy,
            workflow_run_url: runUrl,
            status: "running",
          })
          .select("id")
          .single(),
      );
      return (row as { id: number }).id;
    },
    async finishRun(id, fields) {
      if (id === null) return;
      check(
        "finish the log row",
        await db
          .from("data_update_logs")
          .update({
            status: fields.status,
            finished_at: new Date().toISOString(),
            requests_made: fields.requests,
            retries: fields.retries,
            rows_written: fields.rowsWritten,
            message: fields.message,
            details: fields.details,
          })
          .eq("id", id),
      );
    },
    async closeStaleRuns(olderThanHours) {
      const before = new Date(
        Date.now() - olderThanHours * 3_600_000,
      ).toISOString();
      const rows = check(
        "close stale log rows",
        await db
          .from("data_update_logs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            message: "Did not finish; closed by a later run",
          })
          .eq("status", "running")
          .lt("started_at", before)
          .select("id"),
      );
      return (rows as unknown[] | null)?.length ?? 0;
    },
    async writeSnapshot(payload) {
      check(
        `write snapshot ${key(payload.rank_bracket, payload.period_days)}`,
        await db.rpc("write_stat_snapshot", { payload }),
      );
    },
    async pruneStats(keepDays) {
      const today = new Date().toISOString().slice(0, 10);
      const cutoff = oldestKeptDate(today, keepDays);
      const counted = (
        what: string,
        result: { count: number | null; error: { message: string } | null },
      ) => {
        if (result.error)
          throw new Error(`Database ${what} failed: ${result.error.message}`);
        return result.count ?? 0;
      };

      const snapshots = await selectAll<
        SnapshotWithPairs & { has_matchups: boolean }
      >("read snapshots", (from, to) =>
        db
          .from("stat_snapshots")
          .select(
            "id, rank_bracket, period_days, snapshot_date, is_published, has_matchups",
          )
          .order("id")
          .range(from, to),
      );

      // Pairs only for the newest published snapshot with pairs, per rank and period.
      let matchups = 0;
      let synergies = 0;
      for (const ids of chunks(
        snapshotsToStripPairs(snapshots.filter((s) => s.has_matchups)),
        100,
      )) {
        matchups += counted(
          "prune matchups",
          await db
            .from("hero_matchups")
            .delete({ count: "exact" })
            .in("snapshot_id", ids),
        );
        synergies += counted(
          "prune teammate pairs",
          await db
            .from("hero_synergies")
            .delete({ count: "exact" })
            .in("snapshot_id", ids),
        );
        check(
          "flag pruned snapshots",
          await db
            .from("stat_snapshots")
            .update({ has_matchups: false })
            .in("id", ids),
        );
      }

      // Older snapshots go with their rows (foreign keys cascade).
      let deleted = 0;
      for (const ids of chunks(snapshotsToDelete(snapshots, cutoff), 100)) {
        deleted += counted(
          "prune snapshots",
          await db
            .from("stat_snapshots")
            .delete({ count: "exact" })
            .in("id", ids),
        );
      }
      const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
      const logs = counted(
        "prune update logs",
        await db
          .from("data_update_logs")
          .delete({ count: "exact" })
          .lt("started_at", yearAgo)
          .neq("status", "running"),
      );
      return { matchups, synergies, snapshots: deleted, logs };
    },
    async saveSourceHashes(kind, entries) {
      const seenAt = new Date().toISOString();
      for (const part of chunks(entries)) {
        check(
          "save source hashes",
          await db.from("source_hashes").upsert(
            part.map((e) => ({
              kind,
              source_id: e.id,
              hash: e.hash,
              seen_at: seenAt,
            })),
            {
              onConflict: "kind,source_id",
            },
          ),
        );
      }
    },
    async dropSourceHashes(kind, ids) {
      if (ids.length === 0) return;
      check(
        "drop source hashes",
        await db
          .from("source_hashes")
          .delete()
          .eq("kind", kind)
          .in("source_id", ids),
      );
    },
    async upsertHeroes(rows) {
      for (const part of chunks(rows)) {
        check(
          "write heroes",
          await db.from("heroes").upsert(part, { onConflict: "id" }),
        );
      }
    },
    async replaceHeroDetails(writes) {
      if (writes.length === 0) return;
      const heroIds = writes.map((w) => w.heroId);
      const skills = writes.flatMap((w) => w.skills);
      const relations = writes.flatMap((w) => w.relations);
      // Upsert first, then delete what is gone, so a hero is never left without skills.
      for (const part of chunks(skills)) {
        check(
          "write skills",
          await db
            .from("hero_skills")
            .upsert(part, { onConflict: "hero_id,slot" }),
        );
      }
      for (const part of chunks(relations)) {
        check(
          "write relations",
          await db
            .from("hero_relations")
            .upsert(part, { onConflict: "hero_id,relation,target_hero_id" }),
        );
      }
      const keepSkills = new Set(skills.map((s) => `${s.hero_id}:${s.slot}`));
      const keepRelations = new Set(
        relations.map((r) => `${r.hero_id}:${r.relation}:${r.target_hero_id}`),
      );
      const existingSkills = await selectAll<{ hero_id: number; slot: number }>(
        "read skills",
        (from, to) =>
          db
            .from("hero_skills")
            .select("hero_id, slot")
            .in("hero_id", heroIds)
            .order("id")
            .range(from, to),
      );
      const existingRelations = await selectAll<
        Pick<HeroRelationRow, "hero_id" | "relation" | "target_hero_id">
      >("read relations", (from, to) =>
        db
          .from("hero_relations")
          .select("hero_id, relation, target_hero_id")
          .in("hero_id", heroIds)
          .order("hero_id")
          .order("relation")
          .order("target_hero_id")
          .range(from, to),
      );
      for (const s of existingSkills.filter(
        (s) => !keepSkills.has(`${s.hero_id}:${s.slot}`),
      )) {
        check(
          "delete a skill",
          await db
            .from("hero_skills")
            .delete()
            .eq("hero_id", s.hero_id)
            .eq("slot", s.slot),
        );
      }
      for (const r of existingRelations.filter(
        (r) =>
          !keepRelations.has(`${r.hero_id}:${r.relation}:${r.target_hero_id}`),
      )) {
        check(
          "delete a relation",
          await db
            .from("hero_relations")
            .delete()
            .eq("hero_id", r.hero_id)
            .eq("relation", r.relation)
            .eq("target_hero_id", r.target_hero_id),
        );
      }
    },
    async deactivate(table, ids) {
      if (ids.length === 0) return;
      check(
        `mark ${table} inactive`,
        await db.from(table).update({ is_active: false }).in("id", ids),
      );
    },
    async upsertCatalog(table, rows) {
      for (const part of chunks(rows)) {
        check(
          `write ${table}`,
          await db.from(table).upsert(part, { onConflict: "id" }),
        );
      }
    },
    async deleteCatalog(table, ids) {
      if (ids.length === 0) return;
      check(
        `delete from ${table}`,
        await db.from(table).delete().in("id", ids),
      );
    },
    async insertTags(rows) {
      if (rows.length === 0) return;
      check(
        "insert hero tags",
        await db
          .from("hero_tags")
          .upsert(rows, { onConflict: "hero_id", ignoreDuplicates: true }),
      );
    },
  };
}

/** Reads from `reader`, writes nothing, and records what it would have written. */
export function createDryRunStore(reader: StoreReader): UpdaterStore {
  const recorded: string[] = [];
  const note = (text: string) => {
    recorded.push(text);
  };
  return {
    ...reader,
    dryRun: true,
    recorded,
    async startRun() {
      return null;
    },
    async finishRun() {},
    async closeStaleRuns() {
      return 0;
    },
    async writeSnapshot(p) {
      note(
        `snapshot ${key(p.rank_bracket, p.period_days)}: ${p.stats.length} heroes, ${p.matchups.length} matchups, ${p.synergies.length} teammate pairs`,
      );
    },
    async pruneStats() {
      return {};
    },
    async saveSourceHashes(kind, entries) {
      if (entries.length > 0) note(`${entries.length} ${kind} hashes`);
    },
    async dropSourceHashes() {},
    async upsertHeroes(rows) {
      if (rows.length > 0) note(`${rows.length} heroes`);
    },
    async replaceHeroDetails(writes) {
      if (writes.length > 0)
        note(`skills and relations of ${writes.length} heroes`);
    },
    async deactivate(table, ids) {
      if (ids.length > 0) note(`${ids.length} ${table} marked inactive`);
    },
    async upsertCatalog(table, rows) {
      if (rows.length > 0) note(`${rows.length} ${table}`);
    },
    async deleteCatalog(table, ids) {
      if (ids.length > 0) note(`${ids.length} ${table} deleted`);
    },
    async insertTags(rows) {
      if (rows.length > 0) note(`tags for ${rows.length} heroes`);
    },
  };
}
