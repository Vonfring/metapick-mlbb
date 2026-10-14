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
/** Navigation boxes that list what is currently in the game. */
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

/** Every `link=` target on the emblem portal: the emblem set pages and the talent pages. */
export function emblemPortalLinks(content: string): string[] {
  const links = new Set<string>();
  for (const match of stripComments(content).matchAll(
    /\blink\s*=\s*([^|\]}\n]+)/g,
  )) {
    const title = match[1]!.trim();
    if (title) links.add(title);
  }
  return [...links];
}

/** Our row ID: the wiki page ID when the page exists, else a stable hash of the slug. */
function rowId(
  pages: Record<string, WikiPage>,
  title: string,
  slug: string,
  warnings: string[],
) {
  const page = pages[title];
  if (page) return page.pageid;
  warnings.push(`no wiki page for "${title}": using a hashed ID`);
  return Number.parseInt(
    createHash("sha256").update(slug).digest("hex").slice(0, 7),
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
  jungle: "jungle",
  roaming: "roam",
  roam: "roam",
};

const CATEGORY_ORDER: ItemCategory[] = [
  "attack",
  "magic",
  "defense",
  "movement",
  "jungle",
  "roam",
];

/** Infobox parameters that are not attributes. */
const INFOBOX_FIELDS = new Set([
  "itemname",
  "itemcost",
  "recipecost",
  "category",
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
]);

/** Infobox attribute keys and the labels the game uses for them. */
export const ATTRIBUTE_LABELS: Record<string, string> = {
  physatk: "Physical Attack",
  magicpower: "Magic Power",
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
  physpen: "Physical Penetration",
  magicpen: "Magic Penetration",
};

function titleCase(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAttribute(value: string) {
  const text = plainText(value);
  return /^[+-]/.test(text) ? text : `+${text}`;
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
  const status = plainText(named.get("status") ?? "Available").toLowerCase();
  if (status !== "available") return null;

  const categoryName = plainText(named.get("category") ?? "").toLowerCase();
  const category = ITEM_CATEGORY[categoryName];
  if (!category) {
    warnings.push(
      `item "${page.title}" has an unknown category "${categoryName}", skipped`,
    );
    return null;
  }

  const attributes: LabeledValue[] = [];
  for (const [key, value] of named) {
    if (INFOBOX_FIELDS.has(key) || !plainText(value)) continue;
    const label = ATTRIBUTE_LABELS[key];
    if (!label) unknownKeys.add(key);
    attributes.push({
      label: label ?? titleCase(key),
      value: formatAttribute(value),
    });
  }

  const passives: NamedText[] = [];
  for (const card of findTemplates(
    section(page.content, "Ability") ?? "",
    "SpellCard",
  )) {
    const params = templateParams(card).named;
    const name = plainText(params.get("name") ?? "");
    const description = plainText(params.get("description") ?? "");
    if (!name || !description) continue;
    const kind = plainText(params.get("ability") ?? "").toLowerCase();
    passives.push({
      name: kind === "active" ? `${name} (Active)` : name,
      description,
    });
  }

  const buildsIntoTitles: string[] = [];
  for (const recipe of findTemplates(named.get("recipe") ?? "", "Recipe")) {
    const params = templateParams(recipe).named;
    for (const [key, value] of params) {
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
      `item attributes without a label (shown title-cased): ${[...unknownKeys].sort().join(", ")}`,
    );
  }

  const idByTitle = new Map<string, number>();
  for (const { row } of parsed) idByTitle.set(row.name.toLowerCase(), row.id);
  for (const item of parsed) {
    const ids = item.buildsIntoTitles
      .map((title) => idByTitle.get(title.toLowerCase()))
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

/** Titles linked from a navbox, in order. */
function navboxLinks(content: string) {
  const titles: string[] = [];
  for (const match of stripComments(content).matchAll(
    /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g,
  )) {
    const title = match[1]!.trim();
    if (
      !/^(?:File|Image|Category|Template):/i.test(title) &&
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

type TalentEntry = {
  title: string;
  name: string;
  description: string;
  kind: "standard" | "core";
};

function parseTalentSection(
  text: string | null,
  kind: TalentEntry["kind"],
): TalentEntry[] {
  return findTemplates(text ?? "", "Gameplaybc").map((card) => {
    const params = templateParams(card).named;
    const name = plainText(params.get("title") ?? "");
    return {
      title: plainText(params.get("link") ?? "") || name,
      name,
      description: plainText(params.get("adjustment") ?? ""),
      kind,
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
    const pageTitle = /\blink=([^|\]]+ Emblem)\]\]/.exec(tab)?.[1]?.trim();
    if (!pageTitle) {
      warnings.push(`emblem tab ${index + 1} has no emblem page link, skipped`);
      return;
    }
    const name = pageTitle.replace(/ Emblem$/, "");
    const slug = slugify(name);
    const attributes: LabeledValue[] = [];
    for (const line of plainText(section(tab, "Attributes") ?? "").split(
      "\n",
    )) {
      const match = /^(.+?):\s*(.+)$/.exec(line);
      if (match)
        attributes.push({ label: match[1]!.trim(), value: match[2]!.trim() });
    }
    emblems.push({
      id: rowId(raw.pages, pageTitle, `emblem:${slug}`, warnings),
      slug,
      name,
      attributes,
      icon_url: null,
      recommended_roles: EMBLEM_ROLES[slug] ?? [],
      sort_order: index + 1,
    });

    const entries = [
      ...parseTalentSection(section(tab, "Standard Talents"), "standard"),
      ...parseTalentSection(section(tab, "Core Talents"), "core"),
    ];
    for (const entry of entries) {
      if (!entry.name || seenTalents.has(entry.name.toLowerCase())) continue;
      seenTalents.add(entry.name.toLowerCase());
      talents.push({
        id: rowId(
          raw.pages,
          entry.title,
          `talent:${slugify(entry.name)}`,
          warnings,
        ),
        name: entry.name,
        tier: entry.kind === "core" ? 3 : 1,
        description: entry.description,
        icon_url: null,
        sort_order: talents.length + 1,
      });
    }
  });
  return { emblems, talents };
}

// -------------------------------------------------------------------------------

function assertUniqueIds(kind: string, rows: { id: number; name: string }[]) {
  const seen = new Map<number, string>();
  for (const row of rows) {
    const other = seen.get(row.id);
    if (other)
      throw new Error(
        `${kind} "${row.name}" and "${other}" share the ID ${row.id}`,
      );
    seen.set(row.id, row.name);
  }
}

export function parseCatalog(raw: RawCatalog): ParsedCatalog {
  const warnings: string[] = [];
  const items = parseItems(raw, warnings);
  const spells = parseSpells(raw, warnings);
  const { emblems, talents } = parseEmblems(raw, warnings);
  assertUniqueIds("item", items);
  assertUniqueIds("battle spell", spells);
  assertUniqueIds("emblem", emblems);
  assertUniqueIds("talent", talents);

  const timestamps = Object.values(raw.pages)
    .map((page) => page.timestamp)
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
