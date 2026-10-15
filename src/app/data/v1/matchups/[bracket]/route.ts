import { getMatchupSnapshot } from "@/lib/data";
import { RANK_BRACKETS, type RankBracket } from "@/types/domain";

// Static JSON for Counter pick and Matchup: one file per rank, loaded when a
// visitor picks a rank other than the default. Built with the site and
// refreshed with the rest of the game data.

export async function generateStaticParams() {
  return RANK_BRACKETS.map((bracket) => ({ bracket }));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/data/v1/matchups/[bracket]">,
) {
  const { bracket } = await params;
  if (!(RANK_BRACKETS as readonly string[]).includes(bracket)) {
    return Response.json({ error: "Unknown rank" }, { status: 404 });
  }
  return Response.json(await getMatchupSnapshot(bracket as RankBracket));
}
