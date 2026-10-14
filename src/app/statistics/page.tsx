import type { Metadata } from "next";
import { ChartBarIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Hero statistics",
  description:
    "Win, pick and ban rates for every hero by rank and period, with the change from the previous period.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Hero statistics"
      description="Win, pick and ban rates for every hero by rank and period, with the change from the previous period."
      icon={ChartBarIcon}
    />
  );
}
