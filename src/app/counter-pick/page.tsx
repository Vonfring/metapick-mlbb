import type { Metadata } from "next";
import { CounterMethod } from "@/components/counter-pick/counter-method";
import { CounterPickView } from "@/components/counter-pick/counter-pick-view";
import { PageHeader } from "@/components/meta/page-header";
import { DEFAULT_BRACKET } from "@/config/filters";
import {
  getHeroes,
  getHeroKnowledge,
  getMatchupSnapshot,
  toHeroSummary,
} from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/counter-pick" },
  title: "Counter pick",
  description:
    "Pick up to five enemy heroes and get counters ranked by score, with the reasons behind each one.",
};

export default async function CounterPickPage() {
  const [heroes, knowledge, initial] = await Promise.all([
    getHeroes(),
    getHeroKnowledge(),
    getMatchupSnapshot(DEFAULT_BRACKET),
  ]);

  return (
    <>
      <PageHeader
        title="Counter pick"
        description="Add the enemy heroes you are facing. Counters are ranked by score, and each one shows the numbers behind it."
      />
      <div className="flex flex-col gap-8">
        <CounterPickView
          heroes={heroes.map(toHeroSummary)}
          knowledge={knowledge}
          initial={initial}
        />
        <CounterMethod />
      </div>
    </>
  );
}
