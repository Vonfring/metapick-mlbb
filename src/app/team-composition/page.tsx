import type { Metadata } from "next";
import { PageHeader } from "@/components/meta/page-header";
import { TeamCompositionView } from "@/components/team-composition/team-composition-view";
import { CompositionMethod } from "@/components/tools/composition-method";
import { DEFAULT_BRACKET } from "@/config/filters";
import {
  getHeroes,
  getHeroKnowledge,
  getMatchupSnapshot,
  toHeroSummary,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Team composition",
  description:
    "Pick up to five heroes and see what the lineup has, what it lacks, and which heroes fill the gaps.",
};

export default async function TeamCompositionPage() {
  const [heroes, knowledge, initial] = await Promise.all([
    getHeroes(),
    getHeroKnowledge(),
    getMatchupSnapshot(DEFAULT_BRACKET),
  ]);

  return (
    <>
      <PageHeader
        title="Team composition"
        description="Pick up to five heroes and see what the lineup has, what it lacks, and which heroes fill the gaps."
      />
      <div className="flex flex-col gap-8">
        <TeamCompositionView
          heroes={heroes.map(toHeroSummary)}
          knowledge={knowledge}
          initial={initial}
        />
        <CompositionMethod />
      </div>
    </>
  );
}
