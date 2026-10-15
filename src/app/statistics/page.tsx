import type { Metadata } from "next";
import { PageHeader } from "@/components/meta/page-header";
import { StatisticsView } from "@/components/meta-stats/stats-table";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { getHeroes, getMetaSnapshot, toHeroSummary } from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/statistics" },
  title: "Hero statistics",
  description:
    "Win, pick and ban rates for every Mobile Legends hero by rank and period, with the change from the previous period.",
};

export default async function StatisticsPage() {
  const [heroes, initial] = await Promise.all([
    getHeroes(),
    getMetaSnapshot(DEFAULT_BRACKET, DEFAULT_PERIOD),
  ]);
  const summaries = heroes.map(toHeroSummary);

  return (
    <>
      <PageHeader
        title="Hero statistics"
        description="Win, pick and ban rates for every hero. Pick rate is each hero's share of all picks; ban rate is the share of games in which the hero was banned."
      />
      <StatisticsView heroes={summaries} initial={initial} />
    </>
  );
}
