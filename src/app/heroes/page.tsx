import type { Metadata } from "next";
import { UsersThreeIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Heroes",
  description:
    "Every hero with role, lane, skills, recommended builds, counters and best teammates.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Heroes"
      description="Every hero with role, lane, skills, recommended builds, counters and best teammates."
      icon={UsersThreeIcon}
    />
  );
}
