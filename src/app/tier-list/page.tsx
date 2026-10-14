import type { Metadata } from "next";
import { RankingIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Tier list",
  description:
    "Heroes ranked SS to D from win rate, pick rate and ban rate, by rank and period.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Tier list"
      description="Heroes ranked SS to D from win rate, pick rate and ban rate, by rank and period."
      icon={RankingIcon}
    />
  );
}
