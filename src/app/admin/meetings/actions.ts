"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { meetings, meetingTypeEnum } from "@/db/schema";
import { fail, formObject, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { closeMeeting, getMeeting, openMeeting } from "@/lib/attendance";
import { requireRole } from "@/lib/authz";
import { env } from "@/lib/env";
import { formatCutoff } from "@/lib/cutoff";
import { runSweep } from "@/lib/sweep";
import { fromDateTimeLocalValue } from "@/lib/time";

const Id = z.object({ meetingId: z.uuid() });

/** Mentor+: open a new meeting in the current season. */
export async function startMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireRole("mentor");
    const { notes, type, goToKiosk } = z
      .object({ notes: z.string().max(500).optional(), type: z.enum(meetingTypeEnum.enumValues).optional(), goToKiosk: z.string().optional() })
      .parse(formObject(fd));
    await runSweep();
    const res = await openMeeting(db, { openedBy: user.id, notes: notes?.trim() || null, type, cutoff: env.dailyCutoff });
    if (res.status === "no_current_season") return fail("No current season. An admin needs to create one first.");
    if (res.status === "past_cutoff") return fail(`Meetings can't be started after ${formatCutoff(env.dailyCutoff)}. Check-in is closed for today.`);
    revalidateAll();
    if (goToKiosk) redirect("/kiosk");
    return res.status === "opened" ? ok("Meeting started.") : ok("A meeting is already open.");
  });
}

/** Mentor+: close a meeting; anyone still checked in is auto-checked-out. */
export async function closeMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("mentor");
    const { meetingId } = Id.parse(formObject(fd));
    // Past the daily cutoff, the sweep closes it at the cutoff instead of "now".
    await runSweep();
    const res = await closeMeeting(db, meetingId);
    revalidateAll();
    return ok(
      res.closed
        ? `Meeting closed. ${res.autoCheckedOut} ${res.autoCheckedOut === 1 ? "person was" : "people were"} auto-checked-out.`
        : "Meeting was already closed.",
    );
  });
}

/** Admin: edit meeting times / notes. Mentors may edit notes only. */
export async function updateMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const user = await requireRole("mentor");
    const input = z
      .object({
        meetingId: z.uuid(),
        notes: z.string().max(500).optional(),
        type: z.enum(meetingTypeEnum.enumValues).optional(),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
      })
      .parse(formObject(fd));
    const meeting = await getMeeting(db, input.meetingId);
    if (!meeting) return fail("Meeting not found.");
    const patch: Partial<typeof meetings.$inferInsert> = { notes: input.notes?.trim() || null, type: input.type ?? meeting.type };
    if (user.role === "admin" && input.startsAt) {
      const tz = env.teamTimezone;
      const startsAt = fromDateTimeLocalValue(input.startsAt, tz);
      if (!startsAt) return fail("Invalid start time.");
      let endsAt: Date | null = null;
      if (input.endsAt) {
        endsAt = fromDateTimeLocalValue(input.endsAt, tz);
        if (!endsAt) return fail("Invalid end time.");
        if (endsAt < startsAt) return fail("End must be after start.");
      } else if (!meeting.isOpen) {
        return fail("A closed meeting needs an end time.");
      }
      patch.startsAt = startsAt;
      patch.endsAt = endsAt;
    }
    await db.update(meetings).set(patch).where(eq(meetings.id, meeting.id));
    revalidateAll();
    return ok("Saved. (Changing meeting times doesn't change anyone's check-in times.)");
  });
}

/** Admin: delete a meeting and all its check-ins. */
export async function deleteMeetingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const { meetingId } = Id.parse(formObject(fd));
    await db.delete(meetings).where(eq(meetings.id, meetingId));
    revalidateAll();
    redirect("/admin/meetings");
  });
}
