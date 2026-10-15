import { describe, expect, it } from "vitest";
import { findTemplates, plainText, section, templateParams } from "./wikitext";

const PAGE = `{{Infobox item
<!--Info-->
|itemname=Warrior Boots
|itemcost=720
|category=Movement
|recipe=
	{{Recipe
	|item=Warrior Boots
	|bottomitems=2
	|bottomitem1=Boots
	}}
}}

==Ability==
{{SpellCard
|name=Valor
|description=Gain 4 extra Physical Defense for 3s, up to 20
}}

==Jungling==
{{SpellCard
|name=Hunter
|description=Jungle only
}}`;

describe("findTemplates", () => {
  it("returns balanced templates by name, ignoring longer names", () => {
    expect(findTemplates(PAGE, "Infobox item")).toHaveLength(1);
    expect(findTemplates(PAGE, "SpellCard")).toHaveLength(2);
    expect(findTemplates("{{Recipes|a}} {{Recipe|b}}", "Recipe")).toEqual([
      "Recipe|b",
    ]);
  });
});

describe("templateParams", () => {
  it("splits on top-level pipes only and lower-cases keys", () => {
    const params = templateParams(findTemplates(PAGE, "Infobox item")[0]!);
    expect(params.name).toBe("Infobox item");
    expect(params.named.get("itemcost")).toBe("720");
    expect(params.named.get("recipe")).toContain("{{Recipe");
    expect(findTemplates(params.named.get("recipe")!, "Recipe")).toHaveLength(
      1,
    );
  });

  it("keeps pipes inside links and positional arguments apart", () => {
    const params = templateParams(
      "HeroIcon|Jawhead|20px|note=[[Jawhead|the shark]]",
    );
    expect(params.positional).toEqual(["Jawhead", "20px"]);
    expect(params.named.get("note")).toBe("[[Jawhead|the shark]]");
  });
});

describe("plainText", () => {
  it("keeps link labels and display templates, drops markup", () => {
    expect(
      plainText(
        "'''Extra Speed'''<br>Only if your team includes {{HeroIcon|Jawhead|20px}} &amp; [[Patch 2.1.40|the patch]].{{TextID|nerf}}",
      ),
    ).toBe("Extra Speed\nOnly if your team includes Jawhead & the patch.");
    expect(plainText("====={{HiddenSort|Thrill}}=====")).toBe(
      "=====Thrill=====",
    );
    expect(plainText("<p>\nLine one\n</p>\n\n: Line two")).toBe(
      "Line one\nLine two",
    );
    expect(plainText("[[File:Emblem.png|75px|link=Tank Emblem]]Tank")).toBe(
      "Tank",
    );
  });
});

describe("section", () => {
  it("returns the text under a heading up to the next heading of the same level", () => {
    const ability = section(PAGE, "Ability");
    expect(ability).toContain("Valor");
    expect(ability).not.toContain("Hunter");
    expect(section(PAGE, "Story")).toBeNull();
  });
});
