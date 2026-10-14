import type { Metadata } from "next";
import { PageHeader } from "@/components/meta/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "Where Metapick's hero data comes from, how often it updates, and what is curated by hand.",
};

export default function AboutPage() {
  return (
    <article className="flex max-w-[68ch] flex-col gap-8">
      <PageHeader
        className="pb-0"
        title="About the data"
        description="Metapick is a personal, non-commercial project. Here is where its numbers come from."
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Source</h2>
        <p className="text-muted-foreground">
          Hero details, items, emblems, battle spells and ranked statistics come
          from the data behind the official Mobile Legends: Bang Bang website. A
          scheduled job fetches it once a day, slowly, and stores a copy, so
          browsing Metapick never sends traffic to the official site.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">
          What the numbers mean
        </h2>
        <p className="text-muted-foreground">
          Win rate, pick rate and ban rate are percentages from ranked games in
          the chosen rank and time period. The official data does not include
          match counts, so Metapick cannot show sample sizes. Counter and
          teammate data covers each hero&apos;s strongest and weakest pairings,
          not every possible pair. When a suggestion rests on limited data, the
          page says so.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Curated by hand</h2>
        <p className="text-muted-foreground">
          Team composition checks use hero attributes such as frontline, crowd
          control and damage type. Those are not part of the official data, so
          they are maintained by hand and may lag behind balance changes.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Disclaimer</h2>
        <p className="text-muted-foreground">
          {siteConfig.disclaimer} {siteConfig.attribution}
        </p>
      </section>
    </article>
  );
}
