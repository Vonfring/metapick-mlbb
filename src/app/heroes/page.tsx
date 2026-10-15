import type { Metadata } from "next";
import { HeroBrowser } from "@/components/hero/hero-browser";
import { PageHeader } from "@/components/meta/page-header";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { getRankedHeroes } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { bracketLabels, periodLabels } from "@/types/domain";

export const metadata: Metadata = {
  title: "Heroes",
  description:
    "Every Mobile Legends hero with role, lane, tier and win rate, plus skills, counters and best teammates on each hero's page.",
};

export default async function HeroesPage() {
  const { heroes, snapshot } = await getRankedHeroes(
    DEFAULT_BRACKET,
    DEFAULT_PERIOD,
  );
  const context = snapshot
    ? `${bracketLabels[snapshot.rank_bracket]}, ${periodLabels[snapshot.period_days].toLowerCase()}, updated ${formatDate(snapshot.fetched_at)}`
    : "no statistics yet";

  return (
    <>
      <PageHeader
        title="Heroes"
        description="Find a hero by name, role or lane. Open one for skills, counters and best teammates."
      />
      <HeroBrowser heroes={heroes} context={context} />
    </>
  );
}
