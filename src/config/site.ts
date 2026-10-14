export const siteConfig = {
  name: "Metapick MLBB",
  wordmark: "Metapick",
  label: "MLBB",
  description:
    "Hero data, a meta tier list, counter picks, matchups, team composition checks and a ranked draft simulator for Mobile Legends: Bang Bang.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://metapick-mlbb.vercel.app",
  disclaimer: "Not affiliated with or endorsed by Moonton.",
  attribution:
    "Game data comes from the official Mobile Legends: Bang Bang website. Hero, item and emblem images belong to Moonton.",
} as const;
