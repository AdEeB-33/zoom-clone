import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen is a client-rendered view over the separate FastAPI backend,
  // so there is no server-rendered data for Cache Components to cache. With it
  // off, a page is unmounted when you navigate away and starts fresh when you
  // come back, which keeps the meeting room's state easy to reason about.
  cacheComponents: false,
  turbopack: {
    rules: {
      // Runs Tailwind over CSS files (set up by create-next-app).
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
