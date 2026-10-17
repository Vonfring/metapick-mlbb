import type { Metadata } from "next";
import Link from "next/link";
import { CatalogCredit } from "@/components/meta/catalog-credit";
import { PageHeader } from "@/components/meta/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About the data",
  description:
    "Where Metapick's hero, statistics and item data come from, how often they update, and what is curated by hand.",
};

// Links inside running text need more than color to stand out (WCAG 1.4.1).
const link = "text-ally-text underline underline-offset-2 hover:decoration-2";

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
          Hero details, skills and ranked statistics come from the data behind
          the official Mobile Legends: Bang Bang website. Items, emblems,
          talents and battle spells come from the Liquipedia Mobile Legends
          wiki, because the official MLBB Academy that used to publish them
          closed in June 2026. Scheduled jobs fetch both slowly, statistics
          daily and the rest weekly, and store a copy, so browsing Metapick
          never sends traffic to either site.
        </p>
        <p className="text-muted-foreground">
          Recommended builds closed with the Academy and have no other official
          source, so hero pages do not show them for now.
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
        <h2 className="font-display text-lg font-semibold">
          How the tools decide
        </h2>
        <p className="text-muted-foreground">
          Every suggestion is rule-based: no hidden model, just a few weights
          applied to the numbers above. Each tool explains its own formula at
          the bottom of its page, written from the same settings the scores use:
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          <li>
            <Link href="/tier-list" className={link}>
              Tier list
            </Link>
            : win, pick and ban rate compared with every hero in the same rank
            and period.
          </li>
          <li>
            <Link href="/counter-pick" className={link}>
              Counter pick
            </Link>{" "}
            and{" "}
            <Link href="/matchup" className={link}>
              Matchup
            </Link>
            : matchup statistics, official hero notes and hero tags, plus a
            little for current form.
          </li>
          <li>
            <Link href="/team-composition" className={link}>
              Team composition
            </Link>{" "}
            and{" "}
            <Link href="/draft" className={link}>
              Draft master
            </Link>
            : the composition checklist, synergy between teammates and the same
            counter edges.
          </li>
        </ul>
        <p className="text-muted-foreground">
          Estimates such as &ldquo;56% to 44%&rdquo; explain a draft. They are
          not predictions of a game, which depends far more on the players.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold">Disclaimer</h2>
        <p className="text-muted-foreground">
          {siteConfig.disclaimer} {siteConfig.attribution}
        </p>
        <CatalogCredit className="text-muted-foreground" />
      </section>
    </article>
  );
}
