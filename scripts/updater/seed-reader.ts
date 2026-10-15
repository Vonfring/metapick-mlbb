import { loadSeedInput, type SeedInput } from "../seed/files";
import { snapshotKey, type StoreReader } from "./store";

/**
 * The seed files standing in for the database, for a dry run without the
 * service role key. Catalog source hashes are unknown, so every catalog row
 * counts as changed.
 */
export function createSeedReader(
  load: () => Promise<SeedInput> = () => loadSeedInput(),
): StoreReader {
  let seed: Promise<SeedInput> | null = null;
  const data = () => (seed ??= load());
  return {
    async knownHeroIds() {
      return new Set((await data()).official.heroes.map((h) => h.id));
    },
    async latestSnapshotHashes(sinceDate) {
      const latest = new Map<string, { date: string; hash: string }>();
      for (const s of (await data()).official.snapshots) {
        if (s.snapshot_date < sinceDate) continue;
        const k = snapshotKey(s.rank_bracket, s.period_days);
        const seen = latest.get(k);
        if (!seen || s.snapshot_date > seen.date)
          latest.set(k, { date: s.snapshot_date, hash: s.content_hash });
      }
      return new Map([...latest].map(([k, v]) => [k, v.hash]));
    },
    async sourceHashes() {
      return new Map();
    },
    async activeIds(table) {
      const { official, catalog } = await data();
      const rows = table === "heroes" ? official.heroes : catalog.items;
      return rows.filter((r) => r.is_active !== false).map((r) => r.id);
    },
    async allIds(table) {
      const { catalog } = await data();
      const rows =
        table === "emblems"
          ? catalog.emblems
          : table === "emblem_talents"
            ? catalog.talents
            : catalog.spells;
      return rows.map((r) => r.id);
    },
    async heroIdsWithTags() {
      const { official, tags } = await data();
      return new Set(
        official.heroes.filter((h) => h.slug in tags).map((h) => h.id),
      );
    },
  };
}
