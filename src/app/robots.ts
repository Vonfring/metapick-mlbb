import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The revalidate endpoint and the JSON bundles are not pages.
      disallow: ["/api/", "/data/"],
    },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
