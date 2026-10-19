import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Driver-agnostic database type. Data-access functions accept this so they run
 * against Neon HTTP in production and PGlite in integration tests.
 */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
