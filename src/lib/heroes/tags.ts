import type { HeroTagValues } from "@/types/data";
import type { DamageType } from "@/types/domain";

type LevelKey = Exclude<
  keyof HeroTagValues,
  "damage_type" | "needs_review" | "notes"
>;

/** Curated composition attributes (0 to 3), in display order. */
export const TAG_FIELDS: readonly { key: LevelKey; label: string }[] = [
  { key: "frontline", label: "Frontline" },
  { key: "hard_cc", label: "Hard crowd control" },
  { key: "peel", label: "Peel" },
  { key: "aoe_damage", label: "Area damage" },
  { key: "pickoff", label: "Pick-off" },
  { key: "push", label: "Turret push" },
  { key: "mobility", label: "Mobility" },
  { key: "sustain", label: "Sustain" },
  { key: "burst", label: "Burst" },
  { key: "scaling", label: "Late game" },
];

export const damageTypeLabels: Record<DamageType, string> = {
  physical: "Physical damage",
  magic: "Magic damage",
  mixed: "Mixed damage",
};

/** The official 0 to 100 hero ratings. */
export const RATING_FIELDS = [
  { key: "durability", label: "Durability" },
  { key: "offense", label: "Offense" },
  { key: "control_effect", label: "Control effects" },
  { key: "difficulty", label: "Difficulty" },
] as const;
