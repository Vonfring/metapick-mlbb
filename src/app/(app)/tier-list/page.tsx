import type { Metadata } from "next";
import { PageHeader } from "@/components/meta/page-header";
import { TierListView } from "@/components/meta-stats/tier-list-view";
import { TierMethod } from "@/components/meta-stats/tier-method";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { getHeroes, getMetaSnapshot, toHeroSummary } from "@/lib/data";

export const metadata: Metadata = {
  title: "Tier list",
  description:
    "Mobile Legends heroes ranked SS to D from win rate, pick rate and ban rate, by rank and period.",
};

export default async function TierListPage() {
  const [heroes, initial] = await Promise.all([
    getHeroes(),
    getMetaSnapshot(DEFAULT_BRACKET, DEFAULT_PERIOD),
  ]);
  const summaries = heroes.map(toHeroSummary);

  return (
    <>
      <PageHeader
        title="Tier list"
        description="Every hero ranked SS to D by rank and period. Pick a role or lane to see only those heroes."
      />
      <div className="flex flex-col gap-8">
        <TierListView heroes={summaries} initial={initial} />
        <TierMethod />
      </div>
    </>
  );
}
