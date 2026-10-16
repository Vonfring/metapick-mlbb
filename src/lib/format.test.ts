import { describe, expect, it } from "vitest";
import { initials } from "./format";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Yi Sun-shin")).toBe("YS");
    expect(initials("X.Borg")).toBe("XB");
  });

  it("takes two letters of a single word, ignoring punctuation", () => {
    expect(initials("Fanny")).toBe("FA");
    expect(initials("Chang'e")).toBe("CH");
  });

  it("falls back to a question mark", () => {
    expect(initials("...")).toBe("?");
  });
});
