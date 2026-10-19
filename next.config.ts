import type { NextConfig } from "next";

// Note: Cache Components (cacheComponents) is intentionally NOT enabled.
// Every page in this app is per-user and reads the session cookie + database
// on each request, so we use the classic dynamic rendering model
// (`export const dynamic = "force-dynamic"` in the root layout).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Local-dev-only embedded Postgres (pglite://); never bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
