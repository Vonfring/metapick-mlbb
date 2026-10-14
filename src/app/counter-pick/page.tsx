import type { Metadata } from "next";
import { CrosshairIcon } from "@/components/icons";
import { PlannedPage } from "@/components/meta/planned-page";

export const metadata: Metadata = {
  title: "Counter pick",
  description:
    "Pick up to five enemy heroes and get counters ranked by score, with the reasons behind each one.",
};

export default function Page() {
  return (
    <PlannedPage
      title="Counter pick"
      description="Pick up to five enemy heroes and get counters ranked by score, with the reasons behind each one."
      icon={CrosshairIcon}
    />
  );
}
