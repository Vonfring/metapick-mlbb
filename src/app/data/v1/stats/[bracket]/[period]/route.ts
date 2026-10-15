import { getMetaSnapshot } from "@/lib/data";
import {
  PERIODS,
  RANK_BRACKETS,
  type PeriodDays,
  type RankBracket,
} from "@/types/domain";

// Static JSON for the Statistics and Tier list pages: one file per rank and
// period, loaded when a visitor picks something other than the default.
// Built with the site and refreshed with the rest of the game data.

export async function generateStaticParams() {
  return RANK_BRACKETS.flatMap((bracket) =>
    PERIODS.map((period) => ({ bracket, period: String(period) })),
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/data/v1/stats/[bracket]/[period]">,
) {
  const { bracket, period } = await params;
  const days = Number(period);
  if (
    !(RANK_BRACKETS as readonly string[]).includes(bracket) ||
    !(PERIODS as readonly number[]).includes(days)
  ) {
    return Response.json({ error: "Unknown rank or period" }, { status: 404 });
  }
  return Response.json(
    await getMetaSnapshot(bracket as RankBracket, days as PeriodDays),
  );
}
