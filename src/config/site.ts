export const siteConfig = {
  name: "Metapick MLBB",
  wordmark: "Metapick",
  label: "MLBB",
  description:
    "Hero data, a meta tier list, counter picks, matchups, team composition checks and a ranked draft simulator for Mobile Legends: Bang Bang.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://metapick-mlbb.vercel.app",
  disclaimer: "Not affiliated with or endorsed by Moonton.",
  attribution:
    "Hero data and ranked statistics come from the official Mobile Legends: Bang Bang website. Hero images belong to Moonton.",
  /** Credit required by CC BY-SA 3.0 wherever item, emblem or spell data is shown. */
  catalogCredit: {
    subject: "Item, emblem and battle spell data",
    source: {
      label: "Liquipedia",
      href: "https://liquipedia.net/mobilelegends",
    },
    license: {
      label: "CC BY-SA 3.0",
      href: "https://creativecommons.org/licenses/by-sa/3.0/",
    },
  },
} as const;
