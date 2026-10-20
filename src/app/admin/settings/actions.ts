"use server";

import { z } from "zod";
import { db } from "@/db";
import { settings, themeEnum } from "@/db/schema";
import { fail, formObject, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { requireRole } from "@/lib/authz";

const ThemeInput = z.object({ theme: z.enum(themeEnum.enumValues) });

export async function updateThemeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const parsed = ThemeInput.safeParse(formObject(fd));
    if (!parsed.success) return fail("Pick a theme.");
    await db
      .insert(settings)
      .values({ id: "global", theme: parsed.data.theme })
      .onConflictDoUpdate({ target: settings.id, set: { theme: parsed.data.theme } });
    revalidateAll();
    return ok("Theme updated.");
  });
}
