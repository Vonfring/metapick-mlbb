import type { Metadata } from "next";
import { MatchupMethod } from "@/components/matchup/matchup-method";
import { MatchupView } from "@/components/matchup/matchup-view";
import { PageHeader } from "@/components/meta/page-header";
import { DEFAULT_BRACKET } from "@/config/filters";
import {
  getHeroes,
  getHeroKnowledge,
  getMatchupSnapshot,
  toHeroSummary,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Matchup",
  description:
    "Compare two heroes head to head, or see which team is favored in a five against five game and why.",
};

export default async function MatchupPage() {
  const [heroes, knowledge, initial] = await Promise.all([
    getHeroes(),
    getHeroKnowledge(),
    getMatchupSnapshot(DEFAULT_BRACKET),
  ]);

  return (
    <>
      <PageHeader
        title="Matchup"
        description="Compare two heroes head to head, or two teams of five. Every verdict comes with the numbers behind it."
      />
      <div className="flex flex-col gap-8">
        <MatchupView
          heroes={heroes.map(toHeroSummary)}
          knowledge={knowledge}
          initial={initial}
        />
        <MatchupMethod />
      </div>
    </>
  );
}
