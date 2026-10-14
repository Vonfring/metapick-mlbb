import { createHash } from "node:crypto";

/** "Yi Sun-shin" -> "yi-sun-shin", "Chang'e" -> "chang-e", "X.Borg" -> "x-borg". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

/** Plain text from the source's rich text: tags removed, line breaks kept. */
export function stripMarkup(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[[0-9a-fA-F]{6}\]|\[-\]/g, "")
    .replace(/&(#?\w+);/g, (match, entity: string) => ENTITIES[entity] ?? match)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * A rate as a fraction between 0 and 1. Accepts numbers or numeric strings;
 * values above 1 are treated as percentages. Returns null for anything else.
 */
export function toRate(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseFloat(value.replace("%", "")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const fraction = n > 1 ? n / 100 : n;
  if (fraction < 0 || fraction > 1) return null;
  return Math.round(fraction * 1e6) / 1e6;
}

/** A signed change in rate (fraction). Values beyond +-1 are treated as percentage points. */
export function toDelta(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseFloat(value.replace("%", "")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  const fraction = Math.abs(n) > 1 ? n / 100 : n;
  if (fraction < -1 || fraction > 1) return null;
  return Math.round(fraction * 1e6) / 1e6;
}

export function toInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

/** JSON with sorted keys, so equal data always hashes the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}

/** Read a dotted path such as "hero.data.name" from a nested object. */
export function pick(source: unknown, dottedPath: string): unknown {
  let current: unknown = source;
  for (const key of dottedPath.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
