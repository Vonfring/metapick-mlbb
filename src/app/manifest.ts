import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.wordmark,
    description: siteConfig.description,
    // Installed on a phone, Metapick opens on the tools, not the welcome page.
    start_url: "/app",
    display: "standalone",
    background_color: siteConfig.themeColors.dark,
    theme_color: siteConfig.themeColors.dark,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
