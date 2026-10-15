import { createHash } from "node:crypto";
import type {
  BattleSpellRow,
  EmblemRow,
  EmblemTalentRow,
  ItemRow,
  LabeledValue,
  NamedText,
} from "@/types/data";
import type { HeroRole, ItemCategory } from "@/types/domain";
import type { WikiPage } from "../liquipedia";
import { slugify } from "../normalize";
import {
  findTemplates,
  plainText,
  section,
  stripComments,
  templateParams,
} from "../wikitext";

/** The page that lists every emblem set with its attributes and talents. */
export const EMBLEM_PORTAL = "Portal:Emblems";
/** Navigation boxes that list what is in the game now. */
export const ITEM_NAVBOX = "Template:Equipment";
export const SPELL_NAVBOX = "Template:Battle spells";
export const NAVBOXES = [ITEM_NAVBOX, SPELL_NAVBOX];

/** What `pnpm seed:catalog` downloads: category members plus page wikitext keyed by title. */
export type RawCatalog = {
  fetched_at: string;
  members: { items: string[]; spells: string[] };
  pages: Record<string, WikiPage>;
};

export type ParsedCatalog = {
  items: ItemRow[];
  emblems: EmblemRow[];
  talents: EmblemTalentRow[];
  spells: BattleSpellRow[];
  /** Latest revision time among the pages used. */
  revisedAt: string | null;
  warnings: string[];
};

/**
 * Emblem sets and talents have no wiki pages of their own (a talent name can
 * even be a player's page), so their IDs are a stable hash of the slug.
 */
export function hashedId(kind: string, slug: string) {
  return Number.parseInt(
    createHash("sha256").update(`${kind}:${slug}`).digest("hex").slice(0, 7),
    16,
  );
}

function toInt(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number.parseInt(plainText(value).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Items -----------------------------------------------------------------------

const ITEM_CATEGORY: Record<string, ItemCategory> = {
  attack: "attack",
  magic: "magic",
  defense: "defense",
  movement: "movement",
  jungling: "jungle",
  roaming: "roam",
};

const CATEGORY_ORDER: ItemCategory[] = [
  "attack",
  "magic",
  "defense",
  "movement",
  "jungle",
  "roam",
];

/** Infobox parameters that are not plain attributes. */
const INFOBOX_FIELDS = new Set([
  "itemname",
  "itemcost",
  "recipecost",
  "category",
  "category2",
  "category3",
  "tier",
  "type",
  "status",
  "passive",
  "passive2",
  "passive3",
  "active",
  "recipe",
  "image",
  "icon",
  "caption",
  "uniqueattr",
]);

/** Infobox attribute keys and the labels the game uses for them. */
export const ATTRIBUTE_LABELS: Record<string, string> = {
  physatk: "Physical Attack",
  mp: "Magic Power",
  adaptiveatk: "Adaptive Attack",
  hp: "HP",
  mana: "Mana",
  hpregen: "HP Regen",
  manaregen: "Mana Regen",
  physdefense: "Physical Defense",
  magicdefense: "Magic Defense",
  movespeed: "Movement Speed",
  attackspeed: "Attack Speed",
  critchance: "Crit Chance",
  cdreduction: "CD Reduction",
  lifesteal: "Lifesteal",
  spellvamp: "Spell Vamp",
  hybridsteal: "Hybrid Lifesteal",
  physpen: "Physical Penetration",
  magicpen: "Magic Penetration",
  slowreduction: "Slow Reduction",
};

/** Always percentages in game; the wiki stores them as bare numbers. */
const PERCENT_ATTRIBUTES = new Set([
  "attackspeed",
  "critchance",
  "cdreduction",
  "lifesteal",
  "spellvamp",
  "hybridsteal",
]);

function signed(text: string) {
  return /^[+-]/.test(text) ? text : `+${text}`;
}

/** "40% Critical Damage" becomes { label: "Critical Damage (unique)", value: "+40%" }. */
function uniqueAttribute(value: string): LabeledValue | null {
  const match = /^([+-]?\d+(?:\.\d+)?%?)\s+(.+)$/.exec(plainText(value));
  return match
    ? { label: `${match[2]} (unique)`, value: signed(match[1]!) }
    : null;
}

type ParsedItem = { row: ItemRow; buildsIntoTitles: string[] };

function parseItemPage(
  page: WikiPage,
  warnings: string[],
  unknownKeys: Set<string>,
): ParsedItem | null {
  const infobox = findTemplates(page.content, "Infobox item")[0];
  if (!infobox) {
    warnings.push(`item "${page.title}" has no item infobox, skipped`);
    return null;
  }
  const { named } = templateParams(infobox);
  if (
    plainText(named.get("status") ?? "Available").toLowerCase() !== "available"
  )
    return null;

  const categoryOf = (key: string) =>
    ITEM_CATEGORY[plainText(named.get(key) ?? "").toLowerCase()];
  const category = categoryOf("category");
  if (!category) {
    warnings.push(
      `item "${page.title}" has an unknown category "${named.get("category") ?? ""}", skipped`,
    );
    return null;
  }
  const otherCategories = ["category2", "category3"]
    .map(categoryOf)
    .filter(
      (value): value is ItemCategory =>
        value !== undefined && value !== category,
    );

  const attributes: LabeledValue[] = [];
  for (const [key, value] of named) {
    const text = plainText(value);
    if (INFOBOX_FIELDS.has(key) || !text) continue;
    const label = ATTRIBUTE_LABELS[key];
    if (!label) unknownKeys.add(key);
    const amount =
      PERCENT_ATTRIBUTES.has(key) && /^[+-]?\d+(?:\.\d+)?$/.test(text)
        ? `${text}%`
        : text;
    attributes.push({ label: label ?? key, value: signed(amount) });
  }
  const unique = named.get("uniqueattr");
  if (unique && plainText(unique)) {
    const attribute = uniqueAttribute(unique);
    if (attribute) attributes.push(attribute);
    else
      warnings.push(
        `item "${page.title}": unique attribute "${plainText(unique)}" not understood, skipped`,
      );
  }

  const passives: NamedText[] = [];
  for (const card of findTemplates(
    section(page.content, "Ability") ?? "",
    "SpellCard",
  )) {
    const params = templateParams(card).named;
    const name = plainText(params.get("name") ?? "");
    const description = plainText(params.get("description") ?? "");
    // The unique attribute is already an attribute; some pages repeat it as a card.
    if (!name || !description || name.toLowerCase() === "unique attribute")
      continue;
    const active =
      plainText(params.get("ability") ?? "").toLowerCase() === "active";
    passives.push({ name: active ? `${name} (Active)` : name, description });
  }

  const buildsIntoTitles: string[] = [];
  for (const recipe of findTemplates(named.get("recipe") ?? "", "Recipe")) {
    for (const [key, value] of templateParams(recipe).named) {
      if (/^topitem\d+$/.test(key) && plainText(value))
        buildsIntoTitles.push(plainText(value));
    }
  }

  const name = plainText(named.get("itemname") ?? "") || page.title;
  return {
    row: {
      id: page.pageid,
      slug: slugify(name),
      name,
      category,
      other_categories: [...new Set(otherCategories)],
      tier: toInt(named.get("tier")),
      price: toInt(named.get("itemcost")),
      attributes,
      passives,
      builds_into: [],
      icon_url: null,
    },
    buildsIntoTitles,
  };
}

function parseItems(raw: RawCatalog, warnings: string[]): ItemRow[] {
  const unknownKeys = new Set<string>();
  const parsed: ParsedItem[] = [];
  for (const title of raw.members.items) {
    const page = raw.pages[title];
    if (!page) {
      warnings.push(`item page "${title}" was not downloaded, skipped`);
      continue;
    }
    const item = parseItemPage(page, warnings, unknownKeys);
    if (item) parsed.push(item);
  }
  if (unknownKeys.size > 0) {
    warnings.push(
      `item attributes without a label (shown as the raw key): ${[...unknownKeys].sort().join(", ")}`,
    );
  }

  const idByName = new Map(
    parsed.map(({ row }) => [row.name.toLowerCase(), row.id]),
  );
  for (const item of parsed) {
    const ids = item.buildsIntoTitles
      .map((title) => idByName.get(title.toLowerCase()))
      .filter((id): id is number => id !== undefined);
    item.row.builds_into = [...new Set(ids)];
  }

  return parsed
    .map(({ row }) => row)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) -
          CATEGORY_ORDER.indexOf(b.category) ||
        (a.tier ?? 0) - (b.tier ?? 0) ||
        a.name.localeCompare(b.name),
    );
}

// Battle spells ---------------------------------------------------------------

/** Page titles linked from a navbox, in order. */
function navboxLinks(content: string) {
  const titles: string[] = [];
  for (const match of stripComments(content).matchAll(
    /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g,
  )) {
    const title = match[1]!.trim();
    if (
      !/^(?:File|Image|Category|Template|Portal):/i.test(title) &&
      !titles.includes(title)
    )
      titles.push(title);
  }
  return titles;
}

function parseSpells(raw: RawCatalog, warnings: string[]): BattleSpellRow[] {
  const navbox = raw.pages[SPELL_NAVBOX];
  const current = navbox ? navboxLinks(navbox.content) : null;
  if (!current)
    warnings.push(
      `${SPELL_NAVBOX} was not downloaded: every battle spell page is kept`,
    );

  const spells: BattleSpellRow[] = [];
  for (const title of raw.members.spells) {
    if (current && !current.includes(title)) continue;
    const page = raw.pages[title];
    const card = page ? findTemplates(page.content, "SpellCard")[0] : undefined;
    if (!page || !card) {
      warnings.push(`battle spell "${title}" has no spell card, skipped`);
      continue;
    }
    const params = templateParams(card).named;
    const name = plainText(params.get("name") ?? "") || page.title;
    const cooldown = plainText(params.get("cooldown") ?? "");
    const description = plainText(params.get("description") ?? "");
    spells.push({
      id: page.pageid,
      slug: slugify(name),
      name,
      description: cooldown
        ? `${description}\nCooldown: ${cooldown}`
        : description,
      short_description: null,
      icon_url: null,
      sort_order: current ? current.indexOf(title) + 1 : spells.length + 1,
    });
  }
  for (const title of current ?? []) {
    if (!raw.members.spells.includes(title))
      warnings.push(
        `battle spell "${title}" is in the navbox but not in the category`,
      );
  }
  return spells.sort((a, b) => a.sort_order - b.sort_order);
}

// Emblems and talents -----------------------------------------------------------

const EMBLEM_ROLES: Record<string, HeroRole[]> = {
  tank: ["tank"],
  fighter: ["fighter"],
  assassin: ["assassin"],
  mage: ["mage"],
  marksman: ["marksman"],
  support: ["support"],
};

/**
 * Talents on the portal: standard ones are either a plain attribute bonus
 * (tier 1, no summary line) or an effect with a bold summary line (tier 2);
 * core talents are tier 3.
 */
function parseTalents(text: string | null, core: boolean) {
  return findTemplates(text ?? "", "Gameplaybc").map((card) => {
    const params = templateParams(card).named;
    const adjustment = params.get("adjustment") ?? "";
    const tier = core ? 3 : /'''[^']+'''/.test(adjustment) ? 2 : 1;
    return {
      name: plainText(params.get("title") ?? ""),
      description: plainText(adjustment),
      tier,
    };
  });
}

function parseEmblems(raw: RawCatalog, warnings: string[]) {
  const emblems: EmblemRow[] = [];
  const talents: EmblemTalentRow[] = [];
  const portal = raw.pages[EMBLEM_PORTAL];
  if (!portal) {
    warnings.push(`${EMBLEM_PORTAL} was not downloaded: no emblems`);
    return { emblems, talents };
  }

  const tabs = stripComments(portal.content)
    .split(/\{\{tabs dynamic\/tab\|\d+\}\}/i)
    .slice(1);
  const seenTalents = new Set<string>();
  tabs.forEach((tab, index) => {
    const setName = /\blink=([^|\]]+?) Emblem\]\]/.exec(tab)?.[1]?.trim();
    if (!setName) {
      warnings.push(`emblem tab ${index + 1} has no emblem link, skipped`);
      return;
    }
    const slug = slugify(setName);
    const emblemId = hashedId("emblem", slug);
    const attributes: LabeledValue[] = [];
    for (const line of plainText(section(tab, "Attributes") ?? "").split(
      "\n",
    )) {
      const match = /^(.+?):\s*(.+)$/.exec(line);
      if (match)
        attributes.push({ label: match[1]!.trim(), value: match[2]!.trim() });
    }
    emblems.push({
      id: emblemId,
      slug,
      name: setName,
      attributes,
      icon_url: null,
      recommended_roles: EMBLEM_ROLES[slug] ?? [],
      sort_order: index + 1,
    });

    const entries = [
      ...parseTalents(section(tab, "Standard Talents"), false),
      ...parseTalents(section(tab, "Core Talents"), true),
    ];
    if (entries.length === 0)
      warnings.push(`emblem "${setName}" lists no talents`);
    for (const entry of entries) {
      const key = slugify(entry.name);
      if (!entry.name || seenTalents.has(key)) continue;
      seenTalents.add(key);
      talents.push({
        id: hashedId("talent", key),
        emblem_id: emblemId,
        name: entry.name,
        tier: entry.tier,
        description: entry.description,
        icon_url: null,
        sort_order: talents.length + 1,
      });
    }
  });
  return { emblems, talents };
}

// -------------------------------------------------------------------------------

function assertUnique(
  kind: string,
  rows: { id: number; slug?: string; name: string }[],
) {
  const ids = new Map<number, string>();
  const slugs = new Map<string, string>();
  for (const row of rows) {
    const sameId = ids.get(row.id);
    if (sameId)
      throw new Error(
        `${kind} "${row.name}" and "${sameId}" share the ID ${row.id}`,
      );
    ids.set(row.id, row.name);
    if (row.slug) {
      const sameSlug = slugs.get(row.slug);
      if (sameSlug)
        throw new Error(
          `${kind} "${row.name}" and "${sameSlug}" share the slug ${row.slug}`,
        );
      slugs.set(row.slug, row.name);
    }
  }
}

export function parseCatalog(raw: RawCatalog): ParsedCatalog {
  const warnings: string[] = [];
  const items = parseItems(raw, warnings);
  const spells = parseSpells(raw, warnings);
  const { emblems, talents } = parseEmblems(raw, warnings);
  assertUnique("item", items);
  assertUnique("battle spell", spells);
  assertUnique("emblem", emblems);
  assertUnique("talent", talents);

  const used = [
    ...raw.members.items,
    ...raw.members.spells,
    EMBLEM_PORTAL,
    ...NAVBOXES,
  ];
  const timestamps = used
    .map((title) => raw.pages[title]?.timestamp)
    .filter((stamp): stamp is string => Boolean(stamp))
    .sort();
  return {
    items,
    emblems,
    talents,
    spells,
    revisedAt: timestamps.at(-1) ?? null,
    warnings,
  };
}
