import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PeriodDays, RankBracket } from "@/types/domain";
import { selectAll } from "./paging";
import type { GameDataProvider, SnapshotInfo } from "./provider";
import {
  battleSpellRowSchema,
  emblemRowSchema,
  emblemTalentRowSchema,
  heroRelationRowSchema,
  heroRowSchema,
  heroSkillRowSchema,
  heroStatRowSchema,
  heroTagRowSchema,
  itemRowSchema,
  pairRowSchema,
  statSnapshotRecordSchema,
} from "./schemas";

function createReadClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "DATA_SOURCE is supabase but SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Supabase query failed (${what}): ${error.message}`);
}

const snapshotSchema = statSnapshotRecordSchema
  .pick({
    rank_bracket: true,
    period_days: true,
    snapshot_date: true,
    fetched_at: true,
  })
  .extend({ id: z.number(), has_matchups: z.boolean() });

function snapshotInfo(snapshot: z.infer<typeof snapshotSchema>): SnapshotInfo {
  const { rank_bracket, period_days, snapshot_date, fetched_at } = snapshot;
  return { rank_bracket, period_days, snapshot_date, fetched_at };
}

const pairFromDb = (otherColumn: "opponent_id" | "teammate_id") =>
  z
    .object({
      hero_id: z.number(),
      [otherColumn]: z.number(),
      win_rate_delta: z.number(),
    })
    .transform((row) =>
      pairRowSchema.parse({ ...row, other_id: row[otherColumn] }),
    );

export function createSupabaseProvider(): GameDataProvider {
  const db = createReadClient();

  /** The newest snapshot for one rank and period. RLS only returns published ones. */
  async function newestSnapshot(
    bracket: RankBracket,
    period: PeriodDays,
    onOrBefore?: string,
  ) {
    let query = db
      .from("stat_snapshots")
      .select(
        "id, rank_bracket, period_days, snapshot_date, fetched_at, has_matchups",
      )
      .eq("rank_bracket", bracket)
      .eq("period_days", period);
    if (onOrBefore) query = query.lte("snapshot_date", onOrBefore);
    const { data, error } = await query
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("stat_snapshots", error);
    return data ? snapshotSchema.parse(data) : null;
  }

  return {
    kind: "supabase",
    async listHeroes() {
      const { data, error } = await db
        .from("heroes")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) fail("heroes", error);
      return z.array(heroRowSchema).parse(data);
    },
    async getHeroDetails(slug) {
      const { data: row, error } = await db
        .from("heroes")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) fail("heroes", error);
      if (!row) return null;
      const hero = heroRowSchema.parse(row);
      const [skills, relations, tags] = await Promise.all([
        db.from("hero_skills").select("*").eq("hero_id", hero.id).order("slot"),
        db.from("hero_relations").select("*").eq("hero_id", hero.id),
        db.from("hero_tags").select("*").eq("hero_id", hero.id).maybeSingle(),
      ]);
      if (skills.error) fail("hero_skills", skills.error);
      if (relations.error) fail("hero_relations", relations.error);
      if (tags.error) fail("hero_tags", tags.error);
      return {
        hero,
        skills: z.array(heroSkillRowSchema).parse(skills.data),
        relations: z.array(heroRelationRowSchema).parse(relations.data),
        tags: tags.data ? heroTagRowSchema.parse(tags.data) : null,
      };
    },
    async listHeroTags() {
      const rows = await selectAll("hero_tags", (from, to) =>
        db.from("hero_tags").select("*").order("hero_id").range(from, to),
      );
      return z.array(heroTagRowSchema).parse(rows);
    },
    async listRelations() {
      const rows = await selectAll("hero_relations", (from, to) =>
        db
          .from("hero_relations")
          .select("hero_id, relation, target_hero_id, description")
          .order("hero_id")
          .order("relation")
          .order("target_hero_id")
          .range(from, to),
      );
      return z.array(heroRelationRowSchema).parse(rows);
    },
    async getStats(bracket, period, onOrBefore) {
      const snapshot = await newestSnapshot(bracket, period, onOrBefore);
      if (!snapshot) return null;
      const stats = await selectAll("hero_stats", (from, to) =>
        db
          .from("hero_stats")
          .select("hero_id, win_rate, pick_rate, ban_rate")
          .eq("snapshot_id", snapshot.id)
          .order("hero_id")
          .range(from, to),
      );
      return {
        ...snapshotInfo(snapshot),
        stats: z.array(heroStatRowSchema).parse(stats),
      };
    },
    async getPairs(bracket, period) {
      const snapshot = await newestSnapshot(bracket, period);
      if (!snapshot) return null;
      const [matchups, synergies] = snapshot.has_matchups
        ? await Promise.all([
            selectAll("hero_matchups", (from, to) =>
              db
                .from("hero_matchups")
                .select("hero_id, opponent_id, win_rate_delta")
                .eq("snapshot_id", snapshot.id)
                .order("hero_id")
                .order("opponent_id")
                .range(from, to),
            ),
            selectAll("hero_synergies", (from, to) =>
              db
                .from("hero_synergies")
                .select("hero_id, teammate_id, win_rate_delta")
                .eq("snapshot_id", snapshot.id)
                .order("hero_id")
                .order("teammate_id")
                .range(from, to),
            ),
          ])
        : [[], []];
      return {
        ...snapshotInfo(snapshot),
        matchups: z.array(pairFromDb("opponent_id")).parse(matchups),
        synergies: z.array(pairFromDb("teammate_id")).parse(synergies),
      };
    },
    async listItems() {
      const { data, error } = await db
        .from("items")
        .select("*")
        .eq("is_active", true);
      if (error) fail("items", error);
      return z.array(itemRowSchema).parse(data);
    },
    async getEmblemCatalog() {
      const [emblems, talents] = await Promise.all([
        db.from("emblems").select("*").order("sort_order"),
        db.from("emblem_talents").select("*").order("sort_order"),
      ]);
      if (emblems.error) fail("emblems", emblems.error);
      if (talents.error) fail("emblem_talents", talents.error);
      return {
        emblems: z.array(emblemRowSchema).parse(emblems.data),
        talents: z.array(emblemTalentRowSchema).parse(talents.data),
      };
    },
    async listSpells() {
      const { data, error } = await db
        .from("battle_spells")
        .select("*")
        .order("sort_order");
      if (error) fail("battle_spells", error);
      return z.array(battleSpellRowSchema).parse(data);
    },
    async getLastUpdate() {
      // The last stats run that checked the source, even if nothing changed.
      const runs = await db
        .from("data_update_logs")
        .select("finished_at")
        .eq("job", "stats")
        .in("status", ["success", "skipped", "partial"])
        .not("finished_at", "is", null)
        .order("finished_at", { ascending: false })
        .limit(1);
      if (runs.error) fail("data_update_logs", runs.error);
      const checked = runs.data?.[0]?.finished_at as string | undefined;
      if (checked) return checked;
      // Before the first updater run: when the newest snapshot was fetched.
      const { data, error } = await db
        .from("stat_snapshots")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1);
      if (error) fail("stat_snapshots", error);
      return (data?.[0]?.fetched_at as string | undefined) ?? null;
    },
  };
}
