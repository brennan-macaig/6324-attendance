import "server-only";
import { createRequire } from "node:module";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { AnyDb } from "./types";
import { env } from "@/lib/env";

export type DB = AnyDb;

/**
 * Production: Neon's HTTP driver — one stateless HTTPS request per query,
 * ideal for serverless functions (no pools, no long-lived sockets).
 *
 * Local options:
 *  - A Neon dev branch (same as prod), or
 *  - Docker Postgres + the Neon HTTP proxy (docker-compose.yml) using a
 *    `db.localtest.me` host, which we route to the proxy below, or
 *  - Zero-install demo: DATABASE_URL=pglite://.data/pglite (dev only), an
 *    embedded WASM Postgres. Loaded via createRequire so it is never bundled
 *    into production functions.
 */
function createDb(): DB {
  const url = env.databaseUrl;

  if (url.startsWith("pglite:")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("pglite:// DATABASE_URL is for local development only");
    }
    const g = globalThis as unknown as { __pgliteDb?: DB };
    if (!g.__pgliteDb) {
      const req = createRequire(import.meta.url);
      const { PGlite } = req("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
      const { drizzle: drizzlePglite } = req("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
      const dir = url.replace(/^pglite:\/\//, "") || ".data/pglite";
      (req("node:fs") as typeof import("node:fs")).mkdirSync(dir, { recursive: true });
      g.__pgliteDb = drizzlePglite({ client: new PGlite(dir), schema }) as unknown as DB;
    }
    return g.__pgliteDb;
  }

  if (new URL(url).hostname === "db.localtest.me") {
    neonConfig.fetchEndpoint = (host) => {
      const [protocol, port] = host === "db.localtest.me" ? ["http", 4444] : ["https", 443];
      return `${protocol}://${host}:${port}/sql`;
    };
  }
  return drizzle({ client: neon(url), schema }) as unknown as DB;
}

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) _db = createDb();
  return _db;
}

/**
 * Lazily-initialised DB handle. Importing this module never connects, so
 * `next build` works without DATABASE_URL.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
