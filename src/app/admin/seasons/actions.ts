"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { meetings, seasons } from "@/db/schema";
import { fail, formObject, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { setCurrentSeason } from "@/lib/attendance";
import { requireRole } from "@/lib/authz";
import { isIsoDate } from "@/lib/time";

const IsoDate = z.string().refine(isIsoDate, "Use a valid date");

/** Blank = no target. */
const HoursTarget = z
  .string()
  .optional()
  .transform((s) => (s?.trim() ? Number(s.trim()) : null))
  .refine((n) => n === null || (Number.isFinite(n) && n > 0 && n <= 10000), "Hours target must be a positive number")
  .transform((n) => (n === null ? null : Math.round(n * 10) / 10));

/** Blank = students see progress from the start of the season. */
const OptionalIsoDate = z
  .string()
  .optional()
  .transform((s) => (s?.trim() ? s.trim() : null))
  .refine((s) => s === null || isIsoDate(s), "Use a valid date for 'Show progress from'");

const SeasonInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    startDate: IsoDate,
    endDate: IsoDate,
    hoursTarget: HoursTarget,
    targetVisibleFrom: OptionalIsoDate,
  })
  .refine((s) => s.endDate >= s.startDate, "End date must be on or after start date");

export async function createSeasonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const raw = formObject(fd);
    const input = SeasonInput.parse(raw);
    const [s] = await db.insert(seasons).values(input).returning();
    if (raw.makeCurrent === "on") await setCurrentSeason(db, s.id);
    revalidateAll();
    return ok(`Created ${s.name}.`);
  });
}

export async function updateSeasonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const raw = formObject(fd);
    const id = z.uuid().parse(raw.seasonId);
    const input = SeasonInput.parse(raw);
    const rows = await db.update(seasons).set(input).where(eq(seasons.id, id)).returning({ id: seasons.id });
    if (!rows.length) return fail("Season not found.");
    revalidateAll();
    return ok("Saved.");
  });
}

export async function setCurrentSeasonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const id = z.uuid().parse(fd.get("seasonId"));
    await setCurrentSeason(db, id);
    revalidateAll();
    return ok("Current season updated. New meetings will attach to it.");
  });
}

export async function deleteSeasonAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const id = z.uuid().parse(fd.get("seasonId"));
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(meetings)
      .where(eq(meetings.seasonId, id));
    if (n > 0) return fail("This season has meetings and can't be deleted.");
    await db.delete(seasons).where(eq(seasons.id, id));
    revalidateAll();
    return ok("Deleted.");
  });
}
