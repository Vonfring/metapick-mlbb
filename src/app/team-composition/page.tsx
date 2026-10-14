import type { Metadata } from "next";
import { UsersFourIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Team composition",
  description:
    "Pick five heroes and see what the lineup has, what it lacks, and which heroes fill the gaps.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Team composition"
      description="Pick five heroes and see what the lineup has, what it lacks, and which heroes fill the gaps."
      icon={UsersFourIcon}
    />
  );
}
