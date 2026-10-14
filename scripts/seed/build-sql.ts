/**
 * Build supabase/seed.sql from the JSON files in seed/.
 *
 *   pnpm seed:sql
 *
 * Validates every file first (including your edits to seed/hero-tags.json),
 * prints warnings for rows that point at unknown heroes or items, and writes
 * one idempotent SQL script you can apply with the Supabase CLI or psql.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadSeedInput } from "./files";
import { renderSeedSql } from "./render-sql";

async function main() {
  const input = await loadSeedInput();
  const { sql, warnings, counts } = renderSeedSql(input);
  const target = path.resolve(process.cwd(), "supabase", "seed.sql");
  await writeFile(target, sql);

  console.log(`Wrote ${path.relative(process.cwd(), target)} (${(sql.length / 1024).toFixed(0)} KB)`);
  for (const [name, count] of Object.entries(counts)) console.log(`  ${name}: ${count}`);
  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} warning(s):`);
    for (const warning of warnings.slice(0, 50)) console.warn(`  - ${warning}`);
    if (warnings.length > 50) console.warn(`  ...and ${warnings.length - 50} more`);
  }
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
