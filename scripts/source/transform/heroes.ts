import { z } from "zod";
import type {
  HeroRelationKind,
  HeroRelationRow,
  HeroRow,
  HeroSkillRow,
} from "@/types/data";
import type { HeroLane, HeroRole } from "@/types/domain";
import { slugify, stripMarkup, toInt } from "../normalize";

const ROLE_BY_ID: Record<string, HeroRole> = {
  "1": "tank",
  "2": "fighter",
  "3": "assassin",
  "4": "mage",
  "5": "marksman",
  "6": "support",
};

const LANE_BY_ID: Record<string, HeroLane> = {
  "1": "exp",
  "2": "mid",
  "3": "roam",
  "4": "jungle",
  "5": "gold",
};

const LANE_BY_TITLE: Record<string, HeroLane> = {
  "exp lane": "exp",
  "mid lane": "mid",
  roam: "roam",
  jungle: "jungle",
  jungling: "jungle",
  "gold lane": "gold",
};

const RELATION_KIND: Record<string, HeroRelationKind> = {
  assist: "best_teammate",
  strong: "strong_against",
  weak: "weak_against",
};

// Only the fields we use; everything else in the record is ignored.
const linkedOption = z.union([
  z.looseObject({ data: z.looseObject({}).nullish() }),
  z.string(),
  z.null(),
]);

const skillSchema = z.looseObject({
  skillid: z.union([z.number(), z.string()]).nullish(),
  skillname: z.string().nullish(),
  skilldesc: z.string().nullish(),
  skillicon: z.string().nullish(),
  "skillcd&cost": z.string().nullish(),
  skilltag: z.array(z.looseObject({ tagname: z.string().nullish() })).nullish(),
});

const heroRecordSchema = z.looseObject({
  hero_id: z.union([z.number(), z.string()]),
  head: z.string().nullish(),
  head_big: z.string().nullish(),
  painting: z.string().nullish(),
  hero: z.looseObject({
    data: z.looseObject({
      name: z.string(),
      head: z.string().nullish(),
      painting: z.string().nullish(),
      story: z.string().nullish(),
      speciality: z.array(z.string()).nullish(),
      abilityshow: z.array(z.union([z.string(), z.number()])).nullish(),
      difficulty: z.union([z.string(), z.number()]).nullish(),
      sortid: z.array(linkedOption).nullish(),
      sortlabel: z.array(z.string()).nullish(),
      roadsort: z.array(linkedOption).nullish(),
      roadsortlabel: z.array(z.string()).nullish(),
      heroskilllist: z
        .array(z.looseObject({ skilllist: z.array(skillSchema).nullish() }))
        .nullish(),
    }),
  }),
  relation: z
    .record(
      z.string(),
      z.looseObject({
        desc: z.string().nullish(),
        target_hero_id: z.array(z.union([z.number(), z.string()])).nullish(),
      }),
    )
    .nullish(),
});

export type ParsedHero = {
  hero: HeroRow;
  skills: HeroSkillRow[];
  relations: HeroRelationRow[];
};

const httpUrl = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const percent = (value: unknown) => {
  const n = toInt(value);
  return n !== null && n >= 0 && n <= 100 ? n : null;
};

function optionField(
  option: z.infer<typeof linkedOption>,
  key: string,
): string | null {
  if (!option || typeof option === "string") return null;
  const value = (option.data as Record<string, unknown> | null | undefined)?.[
    key
  ];
  return value === undefined || value === null || value === ""
    ? null
    : String(value);
}

/** "CD: 11   Mana Cost: 60" -> cooldown "11", cost "60 mana". */
export function parseCooldownAndCost(text: string | null | undefined) {
  const source = text ?? "";
  const cooldown =
    /CD:\s*([\d.]+(?:\s*[-/]\s*[\d.]+)*)/i
      .exec(source)?.[1]
      ?.replace(/\s+/g, "") ?? null;
  const costMatch =
    /([A-Za-z]+)\s*Cost:\s*([\d.]+(?:\s*[-/]\s*[\d.]+)*%?)/i.exec(source);
  const cost = costMatch
    ? `${costMatch[2]!.replace(/\s+/g, "")} ${costMatch[1]!.toLowerCase()}`
    : null;
  return { cooldown, cost };
}

export function parseHeroRecord(raw: unknown): ParsedHero {
  const record = heroRecordSchema.parse(raw);
  const data = record.hero.data;
  const id = toInt(record.hero_id);
  if (id === null || id <= 0)
    throw new Error(
      `Hero record without a valid hero_id: ${String(record.hero_id)}`,
    );

  const roles = (data.sortid ?? [])
    .map((option, index) => {
      const byId = optionField(option, "sort_id");
      if (byId && ROLE_BY_ID[byId]) return ROLE_BY_ID[byId];
      const title = (
        optionField(option, "sort_title") ??
        data.sortlabel?.[index] ??
        ""
      ).toLowerCase();
      return (Object.values(ROLE_BY_ID) as string[]).includes(title)
        ? (title as HeroRole)
        : null;
    })
    .filter((role): role is HeroRole => role !== null);

  const lanes = (data.roadsort ?? [])
    .map((option, index) => {
      const byId = optionField(option, "road_sort_id");
      if (byId && LANE_BY_ID[byId]) return LANE_BY_ID[byId];
      const title = (
        optionField(option, "road_sort_title") ??
        data.roadsortlabel?.[index] ??
        ""
      ).toLowerCase();
      return LANE_BY_TITLE[title] ?? null;
    })
    .filter((lane): lane is HeroLane => lane !== null);

  if (roles.length === 0)
    throw new Error(`Hero ${id} (${data.name}) has no recognizable role`);

  const ability = data.abilityshow ?? [];
  const hero: HeroRow = {
    id,
    slug: slugify(data.name),
    name: data.name.trim(),
    roles: [...new Set(roles)].slice(0, 2),
    lanes: [...new Set(lanes)],
    specialties: (data.speciality ?? []).map((s) => s.trim()).filter(Boolean),
    durability: percent(ability[0]),
    offense: percent(ability[1]),
    control_effect: percent(ability[2]),
    difficulty: percent(data.difficulty ?? ability[3]),
    lore: stripMarkup(data.story) || null,
    head_image_url: httpUrl(data.head) ?? httpUrl(record.head),
    portrait_image_url:
      httpUrl(record.painting) ??
      httpUrl(data.painting) ??
      httpUrl(record.head_big),
  };

  // Skill groups repeat shared skills (for example the passive); keep each skill once, in order.
  const seen = new Set<string>();
  const skills: HeroSkillRow[] = [];
  for (const group of data.heroskilllist ?? []) {
    for (const skill of group.skilllist ?? []) {
      const name = skill.skillname?.trim();
      if (!name) continue;
      const key =
        skill.skillid !== null && skill.skillid !== undefined
          ? String(skill.skillid)
          : name;
      if (seen.has(key)) continue;
      seen.add(key);
      const { cooldown, cost } = parseCooldownAndCost(skill["skillcd&cost"]);
      skills.push({
        hero_id: id,
        slot: skills.length,
        source_skill_id: toInt(skill.skillid),
        name,
        description: stripMarkup(skill.skilldesc),
        cooldown,
        cost,
        tags: (skill.skilltag ?? [])
          .map((t) => t.tagname?.trim() ?? "")
          .filter(Boolean),
        icon_url: httpUrl(skill.skillicon),
      });
    }
  }

  const relations: HeroRelationRow[] = [];
  for (const [key, value] of Object.entries(record.relation ?? {})) {
    const relation = RELATION_KIND[key];
    if (!relation) continue;
    const description = stripMarkup(value.desc) || null;
    for (const target of new Set((value.target_hero_id ?? []).map(toInt))) {
      if (target === null || target <= 0 || target === id) continue;
      relations.push({
        hero_id: id,
        relation,
        target_hero_id: target,
        description,
      });
    }
  }

  return { hero, skills, relations };
}
