/**
 * Splits a trailing "Cooldown: 75s" line off a wiki description, so the
 * cooldown can be shown next to the name like hero skills.
 */
export function splitCooldown(text: string): {
  text: string;
  cooldown: string | null;
} {
  const match = /\n\s*Cooldown:\s*(\d+(?:\.\d+)?)\s*s\.?\s*$/i.exec(text);
  if (!match) return { text, cooldown: null };
  return { text: text.slice(0, match.index).trimEnd(), cooldown: match[1]! };
}

/**
 * Talents of tier 2 and up open with a one-line summary ("HP-Based AOE
 * Damage") before the full text.
 */
export function splitSummary(text: string): {
  summary: string | null;
  text: string;
} {
  const newline = text.indexOf("\n");
  if (newline === -1) return { summary: null, text };
  return {
    summary: text.slice(0, newline).trim(),
    text: text.slice(newline + 1).trim(),
  };
}
