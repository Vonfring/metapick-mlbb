import type { PairEdge } from "./counter";

export type ReasonLine = { points: number; text: string };

const lowerFirst = (text: string) =>
  text.charAt(0).toLowerCase() + text.slice(1);

/** Plain sentences for one edge, largest effect first. */
export function edgeLines(
  edge: PairEdge,
  nameOf: (heroId: number) => string,
): ReasonLine[] {
  const hero = nameOf(edge.heroId);
  const opponent = nameOf(edge.opponentId);
  const lines: ReasonLine[] = [];

  if (edge.statsDelta !== null) {
    const size = Math.abs(edge.statsDelta * 100).toFixed(1);
    // Say it the way the source lists it: from the hero whose list has it.
    const text =
      edge.statsFrom === "hero"
        ? `${hero}'s win rate ${edge.statsDelta >= 0 ? "rises" : "falls"} ${size} points against ${opponent}`
        : `${opponent}'s win rate ${edge.statsDelta >= 0 ? "falls" : "rises"} ${size} points against ${hero}`;
    lines.push({ points: edge.points.stats, text });
  }
  for (const note of edge.notes) {
    const [who, whom] =
      note.by === "hero" ? [hero, opponent] : [opponent, hero];
    lines.push({
      points: note.points,
      text: `Official note: ${who} is ${note.kind === "strong_against" ? "strong" : "weak"} against ${whom}`,
    });
  }
  let listed = 0;
  for (const reason of edge.tagReasons) {
    listed += reason.points;
    lines.push({
      points: reason.points,
      text: `${reason.by === "hero" ? hero : opponent}: ${lowerFirst(reason.label)}`,
    });
  }
  // Tag effects too small to list still count; show their sum so the lines
  // add up to the edge.
  const rest = edge.points.tags - listed;
  if (Math.abs(rest) >= 0.05)
    lines.push({ points: rest, text: "Smaller tag effects" });
  lines.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  return lines;
}
