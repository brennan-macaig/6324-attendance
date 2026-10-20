import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { settings, type Theme } from "@/db/schema";
import type { DB } from "@/db";

/**
 * `swatch` (brand-600) is shown in the admin theme picker. `header` (brand-950)
 * drives the browser chrome color (viewport themeColor) and must match the
 * header override for that theme in globals.css.
 */
export const THEMES: { id: Theme; label: string; swatch: string; header: string }[] = [
  { id: "navy", label: "Navy", swatch: "#2f62db", header: "#0b1f3a" },
  { id: "teal", label: "Teal", swatch: "#16827a", header: "#06282a" },
  { id: "green", label: "Green", swatch: "#15804f", header: "#072a1c" },
  { id: "purple", label: "Purple", swatch: "#5b2bb8", header: "#1a0d38" },
  { id: "red", label: "Red", swatch: "#ab1f1f", header: "#350a0a" },
  { id: "orange", label: "Orange", swatch: "#96500c", header: "#301a0a" },
];

/** Site-wide theme, stored in the single `settings` row. Falls back to "navy" if unset or unreachable. */
export const getTheme = cache(async (db: DB): Promise<Theme> => {
  try {
    const [row] = await db.select({ theme: settings.theme }).from(settings).where(eq(settings.id, "global"));
    return row?.theme ?? "navy";
  } catch {
    return "navy";
  }
});
