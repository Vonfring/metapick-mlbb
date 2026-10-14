import type { Metadata } from "next";
import { HexagonIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Emblems",
  description: "Emblem sets and talents, plus the emblems each role uses most.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Emblems"
      description="Emblem sets and talents, plus the emblems each role uses most."
      icon={HexagonIcon}
    />
  );
}
