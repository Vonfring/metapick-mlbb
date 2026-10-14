import { z } from "zod";
import {
  DAMAGE_TYPES,
  HERO_LANES,
  HERO_ROLES,
  ITEM_CATEGORIES,
  RANK_BRACKETS,
} from "@/types/domain";

// Validation for the JSON files in seed/. The same rules as the database
// constraints, so a bad hand edit fails here with a readable message
// instead of halfway through applying seed.sql.

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase words joined by hyphens");
const rate = z.number().min(0).max(1);
const delta = z.number().min(-1).max(1);
const level = z.number().int().min(0).max(3);
const percent = z.number().int().min(0).max(100).nullable();
const url = z.string().url().nullable();
const role = z.enum(HERO_ROLES);
const lane = z.enum(HERO_LANES);
const bracket = z.enum(RANK_BRACKETS);
const period = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(7),
  z.literal(15),
  z.literal(30),
]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime({ offset: true });
const labeledValue = z.object({ label: z.string(), value: z.string() });
const namedText = z.object({ name: z.string(), description: z.string() });

export const heroRowSchema = z.object({
  id: z.number().int().positive(),
  slug,
  name: z.string().min(1),
  roles: z.array(role).min(1).max(2),
  lanes: z.array(lane),
  specialties: z.array(z.string()),
  durability: percent,
  offense: percent,
  control_effect: percent,
  difficulty: percent,
  lore: z.string().nullable(),
  head_image_url: url,
  portrait_image_url: url,
  is_active: z.boolean().optional(),
});

export const heroSkillRowSchema = z.object({
  hero_id: z.number().int().positive(),
  slot: z.number().int().min(0),
  source_skill_id: z.number().int().nullable(),
  name: z.string().min(1),
  description: z.string(),
  cooldown: z.string().nullable(),
  cost: z.string().nullable(),
  tags: z.array(z.string()),
  icon_url: url,
});

export const heroRelationRowSchema = z.object({
  hero_id: z.number().int().positive(),
  relation: z.enum(["best_teammate", "strong_against", "weak_against"]),
  target_hero_id: z.number().int().positive(),
  description: z.string().nullable(),
});

export const heroTagValuesSchema = z.object({
  damage_type: z.enum(DAMAGE_TYPES),
  frontline: level,
  hard_cc: level,
  peel: level,
  aoe_damage: level,
  pickoff: level,
  push: level,
  mobility: level,
  sustain: level,
  burst: level,
  scaling: level,
  needs_review: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

/** seed/hero-tags.json: hero slug to tag values. Keys starting with "_" are comments. */
export const heroTagsFileSchema = z
  .record(z.string(), z.unknown())
  .transform((raw, ctx) => {
    const out: Record<string, z.infer<typeof heroTagValuesSchema>> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith("_")) continue;
      const parsedSlug = slug.safeParse(key);
      if (!parsedSlug.success) {
        ctx.addIssue({
          code: "custom",
          message: `"${key}" is not a valid hero slug`,
          path: [key],
        });
        continue;
      }
      const parsed = heroTagValuesSchema.safeParse(value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: [key, ...issue.path],
          });
        }
        continue;
      }
      out[key] = parsed.data;
    }
    return out;
  });

export const itemRowSchema = z.object({
  id: z.number().int().positive(),
  slug,
  name: z.string().min(1),
  category: z.enum(ITEM_CATEGORIES),
  tier: z.number().int().min(1).max(3).nullable(),
  price: z.number().int().min(0).nullable(),
  attributes: z.array(labeledValue),
  passives: z.array(namedText),
  builds_into: z.array(z.number().int()),
  icon_url: url,
  is_active: z.boolean().optional(),
});

export const itemOverridesFileSchema = z.record(
  z.string(),
  z
    .object({
      price: z.number().int().min(0).nullable(),
      category: z.enum(ITEM_CATEGORIES),
      tier: z.number().int().min(1).max(3).nullable(),
      name: z.string().min(1),
    })
    .partial(),
);

export const emblemRowSchema = z.object({
  id: z.number().int().positive(),
  slug,
  name: z.string().min(1),
  attributes: z.array(labeledValue),
  icon_url: url,
  recommended_roles: z.array(role),
  sort_order: z.number().int(),
});

export const emblemTalentRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  tier: z.number().int().min(1).max(3),
  description: z.string(),
  icon_url: url,
  sort_order: z.number().int(),
});

export const battleSpellRowSchema = z.object({
  id: z.number().int().positive(),
  slug,
  name: z.string().min(1),
  description: z.string(),
  short_description: z.string().nullable(),
  icon_url: url,
  sort_order: z.number().int(),
});

const pairRowSchema = z.object({
  hero_id: z.number().int().positive(),
  other_id: z.number().int().positive(),
  win_rate_delta: delta,
});

export const statSnapshotRecordSchema = z.object({
  rank_bracket: bracket,
  period_days: period,
  snapshot_date: isoDate,
  fetched_at: isoDateTime,
  content_hash: z.string().min(1),
  stats: z.array(
    z.object({
      hero_id: z.number().int().positive(),
      win_rate: rate,
      pick_rate: rate,
      ban_rate: rate,
    }),
  ),
  matchups: z.array(pairRowSchema).optional(),
  synergies: z.array(pairRowSchema).optional(),
});

export const recommendedBuildRecordSchema = z.object({
  hero_id: z.number().int().positive(),
  lane,
  rank_bracket: bracket,
  build_rank: z.number().int().min(1),
  emblem_id: z.number().int().nullable(),
  talent_t1_id: z.number().int().nullable(),
  talent_t2_id: z.number().int().nullable(),
  talent_t3_id: z.number().int().nullable(),
  battle_spell_id: z.number().int().nullable(),
  pick_rate: rate.nullable(),
  win_rate: rate.nullable(),
  item_ids: z.array(z.number().int().positive()).max(6),
});

export const officialMetaSchema = z.object({
  fetched_at: isoDateTime,
  source: z.string(),
  notes: z.string().optional(),
});
