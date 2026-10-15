"use client";

import { ChipGroup } from "@/components/ui/chip-group";

const OPTIONS = [
  { value: "open", label: "Open lanes only" },
  { value: "any", label: "Any lane" },
] as const;

/** Whether suggestions must fit a lane the team still has open. Kept in the URL as ?lanes=any. */
export function LaneFilter({
  openLanesOnly,
  onChange,
}: {
  openLanesOnly: boolean;
  onChange: (openLanesOnly: boolean) => void;
}) {
  return (
    <ChipGroup
      label="Lanes of the suggested heroes"
      options={OPTIONS}
      value={openLanesOnly ? "open" : "any"}
      onChange={(value) => onChange(value === "open")}
    />
  );
}
