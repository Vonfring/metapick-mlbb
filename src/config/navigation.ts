import {
  ChartBarIcon,
  CrosshairIcon,
  HexagonIcon,
  RankingIcon,
  ScalesIcon,
  StrategyIcon,
  SwordIcon,
  UsersFourIcon,
  UsersThreeIcon,
  type IconComponent,
} from "@/components/icons";

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel?: string;
  icon: IconComponent;
  description: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Meta",
    items: [
      {
        href: "/tier-list",
        label: "Tier list",
        shortLabel: "Tiers",
        icon: RankingIcon,
        description: "Every hero ranked SS to D from win, pick and ban rates.",
      },
      {
        href: "/statistics",
        label: "Statistics",
        icon: ChartBarIcon,
        description: "Win, pick and ban rates by rank and period.",
      },
    ],
  },
  {
    label: "Database",
    items: [
      {
        href: "/heroes",
        label: "Heroes",
        icon: UsersThreeIcon,
        description: "Skills, builds, counters and best teammates.",
      },
      {
        href: "/items",
        label: "Items",
        icon: SwordIcon,
        description: "Every item with stats, passives and price.",
      },
      {
        href: "/emblems",
        label: "Emblems",
        icon: HexagonIcon,
        description: "Emblem sets, talents and picks per role.",
      },
    ],
  },
  {
    label: "Tools",
    items: [
      {
        href: "/counter-pick",
        label: "Counter pick",
        shortLabel: "Counter",
        icon: CrosshairIcon,
        description: "Pick up to five enemies and get heroes that beat them.",
      },
      {
        href: "/matchup",
        label: "Matchup",
        icon: ScalesIcon,
        description: "Hero against hero, or team against team.",
      },
      {
        href: "/team-composition",
        label: "Team composition",
        shortLabel: "Team comp",
        icon: UsersFourIcon,
        description: "Check a lineup for missing roles and weak spots.",
      },
      {
        href: "/draft",
        label: "Draft master",
        shortLabel: "Draft",
        icon: StrategyIcon,
        description: "Practice ranked ban and pick with live suggestions.",
      },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((group) => group.items);

/** Routes shown directly in the mobile bottom bar; the rest live under "More". */
export const mobilePrimaryHrefs = [
  "/heroes",
  "/tier-list",
  "/counter-pick",
  "/draft",
] as const;

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
