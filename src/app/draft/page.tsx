import type { Metadata } from "next";
import { StrategyIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Draft master",
  description:
    "Practice ranked ban and pick with live suggestions and a strength score for both teams.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Draft master"
      description="Practice ranked ban and pick with live suggestions and a strength score for both teams."
      icon={StrategyIcon}
    />
  );
}
