import { getNoteTexts } from "@/lib/data";

// Static JSON with the official explanation behind each hero note, keyed
// "heroId:relation". Matchup loads it once two heroes are picked.

export async function GET() {
  return Response.json(await getNoteTexts());
}
