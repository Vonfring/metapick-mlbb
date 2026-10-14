import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Game data changes at most once a day. Cached data refreshes every
    // 6 hours as a fallback; the updater also triggers on-demand revalidation
    // right after each successful run.
    gameData: {
      stale: 5 * 60,
      revalidate: 6 * 60 * 60,
      expire: 7 * 24 * 60 * 60,
    },
  },
  // Hero, item and emblem images load straight from their source URLs.
  // This keeps Vercel's image optimization quota at zero.
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
