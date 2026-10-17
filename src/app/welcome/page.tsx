import type { Metadata, Viewport } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { DEFAULT_BRACKET, DEFAULT_PERIOD } from "@/config/filters";
import { navGroups } from "@/config/navigation";
import { getRankedHeroes } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { cloudHeroes, landingTiers } from "@/lib/landing";
import {
  bracketLabels,
  periodLabels,
  PERIODS,
  RANK_BRACKETS,
} from "@/types/domain";

export const metadata: Metadata = {
  title: "Know the counter before you play",
  description:
    "Counter picks, matchups, team checks and a ranked draft simulator for Mobile Legends. Every suggestion shows the numbers behind it.",
};

// The page has one dark look whatever the app theme.
export const viewport: Viewport = { themeColor: "#0a1017" };

/** Heroes listed on each tier card, and drifting past per tier. */
const PER_TIER_CARD = 8;
const PER_TIER_CLOUD = 5;

/**
 * The welcome page: what Metapick does, for someone who has not used it
 * yet. It lives outside the (app) group, so it has its own header and
 * footer instead of the app shell.
 */
export default async function WelcomePage() {
  const { heroes, snapshot } = await getRankedHeroes(
    DEFAULT_BRACKET,
    DEFAULT_PERIOD,
  );
  const tiers = landingTiers(heroes, PER_TIER_CARD);
  const period = periodLabels[DEFAULT_PERIOD];

  return (
    <LandingPage
      tiers={tiers}
      cloud={cloudHeroes(tiers, PER_TIER_CLOUD)}
      snapshotNote={
        snapshot
          ? `${bracketLabels[DEFAULT_BRACKET]}, ${period.toLowerCase()}, from the ${formatDate(snapshot.snapshot_date)} snapshot.`
          : null
      }
      periodText={period.toLowerCase()}
      rankRange={`${bracketLabels.epic} to ${bracketLabels.glory}`}
      heroCount={heroes.filter((h) => h.winRate !== null).length}
      rankCount={RANK_BRACKETS.length}
      periodCount={PERIODS.length}
      toolCount={navGroups.find((g) => g.label === "Tools")?.items.length ?? 0}
    />
  );
}
