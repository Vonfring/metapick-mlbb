import type { HeroRow } from "@/types/data";
import { laneLabels, roleLabels, type HeroRole } from "@/types/domain";

/** "Fighter and Tank" */
export function rolesText(roles: readonly HeroRole[]): string {
  return roles.map((role) => roleLabels[role]).join(" and ");
}

/** "Fighter and Tank, EXP lane or Roam": the line under a hero's name. */
export function roleLine(hero: Pick<HeroRow, "roles" | "lanes">): string {
  const roles = rolesText(hero.roles);
  return hero.lanes.length > 0
    ? `${roles}, ${hero.lanes.map((lane) => laneLabels[lane]).join(" or ")}`
    : roles;
}
