"use server";

import { z } from "zod";
import { db } from "@/db";
import { fail, formObject, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { addManualCheckin, deleteCheckin, editCheckinTimes } from "@/lib/attendance";
import { requireRole } from "@/lib/authz";
import { env } from "@/lib/env";
import { getUserById } from "@/lib/queries";
import { fromDateTimeLocalValue } from "@/lib/time";

function parseTimes(inStr: string, outStr: string | undefined) {
  const tz = env.teamTimezone;
  const checkedInAt = fromDateTimeLocalValue(inStr, tz);
  if (!checkedInAt) return { error: "Invalid check-in time." } as const;
  let checkedOutAt: Date | null = null;
  if (outStr) {
    checkedOutAt = fromDateTimeLocalValue(outStr, tz);
    if (!checkedOutAt) return { error: "Invalid check-out time." } as const;
    if (checkedOutAt < checkedInAt) return { error: "Check-out must be after check-in." } as const;
  }
  const limit = Date.now() + 5 * 60_000;
  if (checkedInAt.getTime() > limit || (checkedOutAt && checkedOutAt.getTime() > limit)) {
    return { error: "Times can't be in the future." } as const;
  }
  return { checkedInAt, checkedOutAt } as const;
}

/** Admin: edit a check-in's times (records who adjusted). */
export async function editCheckinAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const admin = await requireRole("admin");
    const input = z
      .object({ checkinId: z.uuid(), checkedInAt: z.string().min(1, "Check-in time is required"), checkedOutAt: z.string().optional() })
      .parse(formObject(fd));
    const t = parseTimes(input.checkedInAt, input.checkedOutAt);
    if ("error" in t) return fail(t.error ?? "Invalid time");
    const row = await editCheckinTimes(db, { checkinId: input.checkinId, ...t, adjustedBy: admin.id });
    if (!row) return fail("Check-in not found.");
    revalidateAll();
    return ok("Saved.");
  });
}

/** Admin: add a check-in for a student (flag `manual`). */
export async function addCheckinAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const admin = await requireRole("admin");
    const input = z
      .object({
        studentId: z.uuid("Pick a person"),
        meetingId: z.uuid("Pick a meeting"),
        checkedInAt: z.string().min(1, "Check-in time is required"),
        checkedOutAt: z.string().optional(),
      })
      .parse(formObject(fd));
    if (!(await getUserById(db, input.studentId))) return fail("Person not found.");
    const t = parseTimes(input.checkedInAt, input.checkedOutAt);
    if ("error" in t) return fail(t.error ?? "Invalid time");
    const res = await addManualCheckin(db, {
      studentId: input.studentId,
      meetingId: input.meetingId,
      checkedInAt: t.checkedInAt,
      checkedOutAt: t.checkedOutAt,
      adjustedBy: admin.id,
    });
    if (res.status === "exists") return fail("They already have a check-in for that meeting — edit it instead.");
    if (res.status === "no_meeting") return fail("Meeting not found.");
    revalidateAll();
    return ok("Check-in added.");
  });
}

/** Admin: delete a check-in. */
export async function deleteCheckinAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const { checkinId } = z.object({ checkinId: z.uuid() }).parse(formObject(fd));
    const deleted = await deleteCheckin(db, checkinId);
    revalidateAll();
    return deleted ? ok("Deleted.") : fail("Check-in not found.");
  });
}
