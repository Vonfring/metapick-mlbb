import type { Metadata } from "next";
import { ScalesIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Matchup",
  description:
    "Compare two heroes head to head, or predict which team is favored in a five against five game.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Matchup"
      description="Compare two heroes head to head, or predict which team is favored in a five against five game."
      icon={ScalesIcon}
    />
  );
}
