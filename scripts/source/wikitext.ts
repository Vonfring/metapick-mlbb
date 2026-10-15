/**
 * Small helpers for the Liquipedia wikitext we read: find templates, split
 * their parameters, and turn markup into plain text. Not a full parser; it
 * handles the templates used on the item, spell and emblem pages.
 */

export function stripComments(text: string) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

/** Index just past the `}}` that closes the template opening at `start`, or -1. */
function closingBraces(text: string, start: number) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i += 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth += 1;
      i += 1;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** The inner text (between `{{` and `}}`) of every `{{name ...}}` template, in order. */
export function findTemplates(text: string, name: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  const needle = `{{${name.toLowerCase()}`;
  let from = 0;
  for (;;) {
    const start = lower.indexOf(needle, from);
    if (start === -1) break;
    const next = text[start + needle.length];
    if (next !== undefined && !/[\s|}]/.test(next)) {
      from = start + needle.length;
      continue;
    }
    const end = closingBraces(text, start);
    if (end === -1) break;
    found.push(text.slice(start + 2, end - 2));
    from = end;
  }
  return found;
}

export type TemplateParams = {
  name: string;
  named: Map<string, string>;
  positional: string[];
};

/** Split a template's inner text on top-level `|` into named and positional parameters. */
export function templateParams(template: string): TemplateParams {
  const inner = stripComments(template);
  const parts: string[] = [];
  let curly = 0;
  let square = 0;
  let current = "";
  for (let i = 0; i < inner.length; i += 1) {
    const pair = inner.slice(i, i + 2);
    if (pair === "{{" || pair === "}}" || pair === "[[" || pair === "]]") {
      if (pair === "{{") curly += 1;
      else if (pair === "}}") curly -= 1;
      else if (pair === "[[") square += 1;
      else square -= 1;
      current += pair;
      i += 1;
      continue;
    }
    if (inner[i] === "|" && curly === 0 && square === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += inner[i];
  }
  parts.push(current);

  const [name = "", ...rest] = parts;
  const named = new Map<string, string>();
  const positional: string[] = [];
  for (const part of rest) {
    const match = /^\s*([^=[\]{}]+?)\s*=([\s\S]*)$/.exec(part);
    if (match) named.set(match[1]!.trim().toLowerCase(), match[2]!.trim());
    else positional.push(part.trim());
  }
  return { name: name.trim(), named, positional };
}

/** Templates whose first argument is the text to show. */
const SHOW_FIRST_ARGUMENT = new Set([
  "hiddensort",
  "heroicon",
  "itemicon",
  "spellicon",
  "emblemicon",
]);

/** Resolve templates innermost first: keep display text, drop everything else. */
function replaceTemplates(text: string) {
  let result = text;
  const innermost = /\{\{([^{}]*)\}\}/;
  for (let guard = 0; guard < 10_000; guard += 1) {
    const match = innermost.exec(result);
    if (!match) break;
    const params = templateParams(match[1]!);
    const name = params.name.toLowerCase();
    let replacement = "";
    if (name === "=") replacement = "=";
    else if (name === "!") replacement = "|";
    else if (SHOW_FIRST_ARGUMENT.has(name))
      replacement = params.positional[0] ?? "";
    result =
      result.slice(0, match.index) +
      replacement +
      result.slice(match.index + match[0].length);
  }
  return result;
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Wikitext to plain text: links become their label, markup and unknown templates go. */
export function plainText(wikitext: string) {
  let text = replaceTemplates(stripComments(wikitext));
  text = text
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(
      /&[#a-z0-9]+;/gi,
      (entity) => ENTITIES[entity.toLowerCase()] ?? entity,
    );
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/[\t ]+/g, " ")
        .replace(/^[:;*#]+\s*/, "")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

/** The text of a `==Heading==` section (any level), up to the next heading of the same or higher level. */
export function section(wikitext: string, heading: string) {
  const lines = wikitext.split("\n");
  const pattern = /^(={2,6})\s*(.*?)\s*\1\s*$/;
  let level = 0;
  const out: string[] = [];
  for (const line of lines) {
    const match = pattern.exec(line);
    if (level > 0) {
      if (match && match[1]!.length <= level) break;
      out.push(line);
    } else if (
      match &&
      plainText(match[2]!).toLowerCase() === heading.toLowerCase()
    ) {
      level = match[1]!.length;
    }
  }
  return level > 0 ? out.join("\n") : null;
}
