import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
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
  officialMetaSchema,
  recommendedBuildRecordSchema,
  statSnapshotRecordSchema,
} from "@/lib/data/schemas";

export const SEED_DIR = path.resolve(process.cwd(), "seed");
export const OFFICIAL_DIR = path.join(SEED_DIR, "official");

export const officialFiles = {
  meta: { file: "meta.json", schema: officialMetaSchema },
  heroes: { file: "heroes.json", schema: z.array(heroRowSchema) },
  skills: { file: "skills.json", schema: z.array(heroSkillRowSchema) },
  relations: { file: "relations.json", schema: z.array(heroRelationRowSchema) },
  items: { file: "items.json", schema: z.array(itemRowSchema) },
  emblems: { file: "emblems.json", schema: z.array(emblemRowSchema) },
  talents: { file: "talents.json", schema: z.array(emblemTalentRowSchema) },
  spells: { file: "spells.json", schema: z.array(battleSpellRowSchema) },
  builds: { file: "builds.json", schema: z.array(recommendedBuildRecordSchema) },
  snapshots: { file: "stats.json", schema: z.array(statSnapshotRecordSchema) },
} as const;

type OfficialKey = keyof typeof officialFiles;
export type OfficialData = {
  [K in OfficialKey]: z.infer<(typeof officialFiles)[K]["schema"]>;
};

export type SeedInput = {
  official: OfficialData;
  tags: z.infer<typeof heroTagsFileSchema>;
  itemOverrides: z.infer<typeof itemOverridesFileSchema>;
};

function describeIssues(file: string, error: z.ZodError) {
  const lines = error.issues
    .slice(0, 20)
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  const more = error.issues.length > 20 ? `\n  ...and ${error.issues.length - 20} more` : "";
  return `${file} is invalid:\n${lines.join("\n")}${more}`;
}

export async function readJson<S extends z.ZodType>(file: string, schema: S): Promise<z.infer<S>> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new Error(`Missing seed file: ${path.relative(process.cwd(), file)}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path.relative(process.cwd(), file)} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new Error(describeIssues(path.relative(process.cwd(), file), parsed.error));
  return parsed.data;
}

export async function loadSeedInput(seedDir = SEED_DIR): Promise<SeedInput> {
  const officialDir = path.join(seedDir, "official");
  const entries = await Promise.all(
    Object.entries(officialFiles).map(async ([key, { file, schema }]) => [
      key,
      await readJson(path.join(officialDir, file), schema),
    ]),
  );
  const official = Object.fromEntries(entries) as OfficialData;
  const tags = await readJson(path.join(seedDir, "hero-tags.json"), heroTagsFileSchema);
  const itemOverrides = await readJson(
    path.join(seedDir, "overrides", "items.json"),
    itemOverridesFileSchema,
  );
  return { official, tags, itemOverrides };
}
