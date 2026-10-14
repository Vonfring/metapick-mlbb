import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { GameDataProvider } from "./provider";
import { heroRowSchema } from "./schemas";

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

export function createSupabaseProvider(): GameDataProvider {
  const db = createReadClient();
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
    async getLastUpdate() {
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
