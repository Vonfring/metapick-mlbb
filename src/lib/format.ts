/** Display helpers. Rates and deltas are stored as fractions (0.523 = 52.3%). */

export function formatPercent(
  fraction: number | null | undefined,
  digits = 1,
): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction))
    return "No data";
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Signed points with a true minus sign: "+4.8", "−1.2", "0.0". */
export function formatPoints(points: number, digits = 1): string {
  const rounded = Number(points.toFixed(digits));
  const text = Math.abs(rounded).toFixed(digits);
  return rounded > 0 ? `+${text}` : rounded < 0 ? `−${text}` : text;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "14 Oct 2026" from an ISO date or timestamp. */
export function formatDate(iso: string): string {
  return dateFormat.format(
    new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso),
  );
}

const goldFormat = new Intl.NumberFormat("en-US");

export function formatGold(amount: number): string {
  return goldFormat.format(amount);
}

/** Lowercase, accent-free text for forgiving search ("Chang'e" matches "change"). */
export function searchKey(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Sorts names the same way on the server and in every browser. A plain
 * localeCompare follows the visitor's language (Danish puts "Aa" last), so
 * a list sorted on both sides would no longer match after hydration.
 */
export const compareNames = new Intl.Collator("en").compare;
