import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { themeEnum } from "@/db/schema";
import type { AnyDb } from "@/db/types";

// src/lib/theme.ts is `import "server-only"`-gated; stub it so this Server-only
// module can be exercised directly from a plain (non-React-Server) test run.
vi.mock("server-only", () => ({}));
const { getTheme, THEMES } = await import("@/lib/theme");

async function freshDb(): Promise<AnyDb> {
  const client = new PGlite();
  const dir = path.join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  return drizzle({ client, schema }) as unknown as AnyDb;
}

describe("getTheme", () => {
  it("defaults to navy after the seed insert runs", async () => {
    const db = await freshDb();
    expect(await getTheme(db)).toBe("navy");
  });

  it("reflects an updated settings row", async () => {
    const db = await freshDb();
    await db.update(schema.settings).set({ theme: "purple" }).where(eq(schema.settings.id, "global"));
    expect(await getTheme(db)).toBe("purple");
  });

  it("falls back to navy without throwing when the settings table doesn't exist", async () => {
    const client = new PGlite();
    const db = drizzle({ client, schema }) as unknown as AnyDb;
    await expect(getTheme(db)).resolves.toBe("navy");
  });
});

describe("THEMES", () => {
  it("describes exactly the same set of ids as the theme enum", () => {
    expect(THEMES.length).toBe(themeEnum.enumValues.length);
    for (const value of themeEnum.enumValues) {
      expect(THEMES.some((t) => t.id === value)).toBe(true);
    }
    for (const theme of THEMES) {
      expect(themeEnum.enumValues).toContain(theme.id);
    }
  });

  it("has a non-empty label and valid hex swatch/header colors for every entry", () => {
    for (const theme of THEMES) {
      expect(theme.label.length).toBeGreaterThan(0);
      expect(theme.swatch).toMatch(/^#[0-9a-f]{6}$/i);
      expect(theme.header).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has unique ids", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
