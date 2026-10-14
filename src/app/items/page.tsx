import type { Metadata } from "next";
import { SwordIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Items",
  description: "All items grouped by category, with stats, passives and price.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Items"
      description="All items grouped by category, with stats, passives and price."
      icon={SwordIcon}
    />
  );
}
