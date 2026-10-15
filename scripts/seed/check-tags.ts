/** Validate seed/hero-tags.json on its own: `pnpm seed:check-tags`. */
import path from "node:path";
import { heroTagsFileSchema } from "@/lib/data/schemas";
import { readJson, SEED_DIR } from "./files";

readJson(path.join(SEED_DIR, "hero-tags.json"), heroTagsFileSchema)
  .then((tags) => {
    const entries = Object.entries(tags);
    const review = entries.filter(([, v]) => v.needs_review).map(([slug]) => slug);
    console.log(`hero-tags.json is valid: ${entries.length} heroes, ${review.length} marked needs_review`);
    if (review.length > 0) console.log(`  needs review: ${review.join(", ")}`);
  })
  .catch((error: unknown) => {
    console.error((error as Error).message);
    process.exit(1);
  });
