import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.wordmark,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0e1a21",
    theme_color: "#0e1a21",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
