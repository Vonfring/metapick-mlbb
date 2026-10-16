import { describe, expect, it } from "vitest";
import { DRAFT_PRESETS, type DraftPresetId } from "@/config/draft-order";
import {
  currentStep,
  entryOrder,
  expandSteps,
  parseSlots,
  picksOf,
  serializeSlots,
  SKIP,
  teamSlots,
  turnPosition,
  undoSlots,
} from "./board";

const slugs = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
];
const idOf = (slug: string) => {
  const i = slugs.indexOf(slug);
  return i === -1 ? undefined : i + 1;
};
const slugOf = (id: number) => slugs[id - 1]!;

describe("presets", () => {
  const counts = (id: DraftPresetId) => {
    const steps = expandSteps(DRAFT_PRESETS[id]);
    const n = (team: string, action: string) =>
      steps.filter((s) => s.team === team && s.action === action).length;
    return {
      blueBans: n("blue", "ban"),
      redBans: n("red", "ban"),
      bluePicks: n("blue", "pick"),
      redPicks: n("red", "pick"),
    };
  };

  it("gives each team the ranked number of bans and five picks", () => {
    expect(counts("epic")).toEqual({
      blueBans: 3,
      redBans: 3,
      bluePicks: 5,
      redPicks: 5,
    });
    expect(counts("legend")).toEqual({
      blueBans: 4,
      redBans: 4,
      bluePicks: 5,
      redPicks: 5,
    });
    expect(counts("mythic")).toEqual({
      blueBans: 5,
      redBans: 5,
      bluePicks: 5,
      redPicks: 5,
    });
    expect(counts("mpl")).toEqual({
      blueBans: 5,
      redBans: 5,
      bluePicks: 5,
      redPicks: 5,
    });
  });

  it("picks in snake order after both Mythic ban waves", () => {
    const steps = expandSteps(DRAFT_PRESETS.mythic);
    expect(steps.slice(0, 10).every((s) => s.action === "ban" && s.blind)).toBe(
      true,
    );
    expect(
      steps
        .slice(10)
        .map((s) => (s.team === "blue" ? "B" : "R"))
        .join(""),
    ).toBe("BRRBBRRBBR");
  });
});

describe("board", () => {
  const steps = expandSteps(DRAFT_PRESETS.mythic);

  it("asks for your team's blind bans first", () => {
    const order = entryOrder(steps, "red");
    expect(order.slice(0, 3).map((i) => steps[i]!.team)).toEqual([
      "red",
      "red",
      "red",
    ]);
    expect(order.slice(3, 6).map((i) => steps[i]!.team)).toEqual([
      "blue",
      "blue",
      "blue",
    ]);
  });

  it("reads back what it writes", () => {
    const value = "a,b,-,c,d,e,f,g,h,i,j,k";
    const slots = parseSlots(value, steps, idOf);
    expect(slots.slice(0, 3)).toEqual([1, 2, SKIP]);
    expect(serializeSlots(slots, slugOf)).toBe(value);
  });

  it("lets both teams ban the same hero in a blind phase, but not twice for one team", () => {
    expect(parseSlots("a,b,c,a,d,e", steps, idOf).slice(0, 6)).toEqual([
      1, 2, 3, 1, 4, 5,
    ]);
    // Blue bans "a" twice: blue's bans stop at the repeat; red's still count.
    expect(parseSlots("a,a,c,d,e,f", steps, idOf).slice(0, 7)).toEqual([
      1,
      null,
      null,
      4,
      5,
      6,
      null,
    ]);
  });

  it("refuses to pick a banned hero and drops the rest of the list", () => {
    // Bans a-j, then blue picks "a".
    const slots = parseSlots("a,b,c,d,e,f,g,h,i,j,a,k", steps, idOf);
    expect(slots.slice(10).every((s) => s === null)).toBe(true);
  });

  it("keeps each team's bans up to its first gap in a blind phase", () => {
    const slots = parseSlots("a,b,_,c,d,e", steps, idOf);
    expect(slots.slice(0, 6)).toEqual([1, 2, null, 3, 4, 5]);
    // The second wave is not read while the first is unfinished.
    expect(parseSlots("a,b,_,c,d,e,f", steps, idOf)[6]).toBeNull();
  });

  it("finds the turn, undoes in entry order and survives a side swap mid-phase", () => {
    let slots = parseSlots("a,b,c", steps, idOf);
    // Blue has banned 3; as blue, red's first ban is next.
    expect(currentStep(steps, slots, "blue")).toMatchObject({
      team: "red",
      action: "ban",
    });
    // Swapped to red, the same board still asks for red's bans.
    expect(currentStep(steps, slots, "red")).toMatchObject({
      team: "red",
      action: "ban",
    });
    slots = undoSlots(steps, slots, "blue");
    expect(slots.slice(0, 3)).toEqual([1, 2, null]);
  });

  it("takes back the ban just made after switching sides in a blind phase", () => {
    // Blue banned three, red one; then the player switches to red.
    const slots = parseSlots("a,b,c,d", steps, idOf);
    expect(currentStep(steps, slots, "red")).toMatchObject({ index: 4 });
    expect(undoSlots(steps, slots, "red").slice(0, 6)).toEqual([
      1,
      2,
      3,
      null,
      null,
      null,
    ]);
  });

  it("counts the steps of a run, as in pick 2 of 2", () => {
    const slots = parseSlots("a,b,c,d,e,f,g,h,i,j,k,l", steps, idOf);
    const current = currentStep(steps, slots, "blue")!;
    expect(current).toMatchObject({ team: "red", action: "pick" });
    expect(turnPosition(steps, "blue", current)).toEqual({ number: 2, of: 2 });
    expect(picksOf(steps, slots, "blue")).toEqual([11]);
    expect(teamSlots(steps, slots, "red", "pick")).toEqual([
      12,
      null,
      null,
      null,
      null,
    ]);
  });

  it("does not let a team ban a hero the other already banned in a turn-based phase", () => {
    const mpl = expandSteps(DRAFT_PRESETS.mpl);
    expect(parseSlots("a,a", mpl, idOf)).toEqual([
      1,
      ...Array(mpl.length - 1).fill(null),
    ]);
  });
});
