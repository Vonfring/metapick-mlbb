import type { Metadata } from "next";
import { DraftView } from "@/components/draft/draft-view";
import { PageHeader } from "@/components/meta/page-header";
import { CompositionMethod } from "@/components/tools/composition-method";
import { DEFAULT_BRACKET } from "@/config/filters";
import {
  getHeroes,
  getHeroKnowledge,
  getMatchupSnapshot,
  toHeroSummary,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Draft master",
  description:
    "Practice ranked ban and pick with suggestions on every turn and a strength score for both teams.",
};

export default async function DraftPage() {
  const [heroes, knowledge, initial] = await Promise.all([
    getHeroes(),
    getHeroKnowledge(),
    getMatchupSnapshot(DEFAULT_BRACKET),
  ]);

  return (
    <>
      <PageHeader
        title="Draft master"
        description="Practice a ranked ban and pick. Enter both teams' heroes as they happen; every turn suggests heroes and shows why."
      />
      <div className="flex flex-col gap-8">
        <DraftView
          heroes={heroes.map(toHeroSummary)}
          knowledge={knowledge}
          initial={initial}
        />
        <CompositionMethod title="How suggestions and strength work" />
      </div>
    </>
  );
}
