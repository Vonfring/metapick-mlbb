/**
 * Ban and pick order presets for Draft master (docs/activity-draft-master.md).
 *
 * A preset is a list of phases. Blind ban phases are entered by both teams
 * without seeing each other's bans, as in ranked; the board asks for your
 * team's bans first. In turn-based phases each letter is one step, in order:
 * "B" for blue, "R" for red.
 */
export type DraftTeam = "blue" | "red";
export type DraftAction = "ban" | "pick";

export type DraftPhase =
  | { action: "ban"; blind: true; perTeam: number }
  | { action: DraftAction; blind: false; order: string };

export type DraftPreset = {
  label: string;
  description: string;
  phases: readonly DraftPhase[];
};

/** Snake order: Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1. */
const RANKED_PICKS = "BRRBBRRBBR";

export const DRAFT_PRESETS = {
  mythic: {
    label: "Ranked: Mythic and above",
    description:
      "5 bans a team in two blind waves (3, then 2), then picks in snake order.",
    phases: [
      { action: "ban", blind: true, perTeam: 3 },
      { action: "ban", blind: true, perTeam: 2 },
      { action: "pick", blind: false, order: RANKED_PICKS },
    ],
  },
  legend: {
    label: "Ranked: Legend",
    description: "4 blind bans a team, then picks in snake order.",
    phases: [
      { action: "ban", blind: true, perTeam: 4 },
      { action: "pick", blind: false, order: RANKED_PICKS },
    ],
  },
  epic: {
    label: "Ranked: Epic",
    description: "3 blind bans a team, then picks in snake order.",
    phases: [
      { action: "ban", blind: true, perTeam: 3 },
      { action: "pick", blind: false, order: RANKED_PICKS },
    ],
  },
  mpl: {
    label: "Tournament (MPL)",
    description:
      "3 bans each in turn, 3 picks each, 2 more bans each, then the last 2 picks each.",
    phases: [
      { action: "ban", blind: false, order: "BRBRBR" },
      { action: "pick", blind: false, order: "BRRBBR" },
      { action: "ban", blind: false, order: "RBRB" },
      { action: "pick", blind: false, order: "RBBR" },
    ],
  },
} as const satisfies Record<string, DraftPreset>;

export type DraftPresetId = keyof typeof DRAFT_PRESETS;

export const DEFAULT_PRESET: DraftPresetId = "mythic";
export const DEFAULT_SIDE: DraftTeam = "blue";
