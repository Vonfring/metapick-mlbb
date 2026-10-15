import type { HeroSkillRow } from "@/types/data";

/**
 * Skills in display order without repeats. Heroes with several forms or
 * weapons (Beatrix, Lunox, Popol and Kupa, ...) list shared skills once per
 * form in the source data; identical name and text are shown once.
 */
export function displaySkills(skills: readonly HeroSkillRow[]): HeroSkillRow[] {
  const seen = new Set<string>();
  return [...skills]
    .sort((a, b) => a.slot - b.slot)
    .filter((skill) => {
      const key = `${skill.name}\u0000${skill.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
