import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"], quiet: true });

// Prefer Neon's *unpooled* URL for migrations. drizzle-kit connects over TCP
// with the `postgres` driver (works for Neon and local Postgres), or uses the
// embedded PGlite driver for `pglite://<dir>` URLs (local demo only).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
const pglite = url.startsWith("pglite:");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  ...(pglite
    ? { driver: "pglite" as const, dbCredentials: { url: url.replace(/^pglite:\/\//, "") || ".data/pglite" } }
    : { dbCredentials: { url } }),
  strict: true,
  verbose: true,
});
