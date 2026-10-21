import { and, eq, inArray, isNull, lt, ne, not, sql } from "drizzle-orm";
import { checkins, meetings, seasons, type Checkin, type Meeting, type MeetingType } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import { cutoffForDay, isPastCutoff, type DailyCutoff } from "./cutoff";
import { computeCheckinFlags, FLAG } from "./flags";
import { dayRangeInTz, isoDateInTz } from "./time";

/**
 * Attendance mutations. Every function here assumes the caller has ALREADY
 * authorised the actor (see src/lib/authz.ts) and validated input.
 */

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

const appendFlag = (flag: string) =>
  sql`CASE WHEN ${flag} = ANY(${checkins.flags}) THEN ${checkins.flags} ELSE array_append(${checkins.flags}, ${flag}::text) END`;

export type CheckinStatus = "not_checked_in" | "checked_in" | "checked_out";

export function statusOf(c: Pick<Checkin, "checkedOutAt"> | null | undefined): CheckinStatus {
  if (!c) return "not_checked_in";
  return c.checkedOutAt ? "checked_out" : "checked_in";
}

export async function getCheckin(db: AnyDb, studentId: string, meetingId: string): Promise<Checkin | null> {
  const [row] = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.studentId, studentId), eq(checkins.meetingId, meetingId)))
    .limit(1);
  return row ?? null;
}

export async function getMeeting(db: AnyDb, meetingId: string): Promise<Meeting | null> {
  const [row] = await db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1);
  return row ?? null;
}

export async function getOpenMeeting(db: AnyDb): Promise<Meeting | null> {
  const [row] = await db.select().from(meetings).where(eq(meetings.isOpen, true)).limit(1);
  return row ?? null;
}

export type CheckInResult =
  | { status: "checked_in"; checkin: Checkin }
  | { status: "already_checked_in" | "already_checked_out"; checkin: Checkin }
  | { status: "meeting_closed" | "no_meeting" | "past_cutoff" };

/**
 * Idempotent check-in (INSERT ... ON CONFLICT DO NOTHING). With `cutoff`,
 * new check-ins at/after the daily cutoff (e.g. 9:00 PM) are rejected.
 */
export async function checkIn(
  db: AnyDb,
  input: {
    studentId: string;
    meetingId: string;
    ip: string | null;
    deviceId: string | null;
    schoolIpRanges: string[];
    cutoff?: DailyCutoff | null;
    now?: Date;
  },
): Promise<CheckInResult> {
  const now = input.now ?? new Date();
  const meeting = await getMeeting(db, input.meetingId);
  if (!meeting) return { status: "no_meeting" };
  if (!meeting.isOpen) return { status: "meeting_closed" };
  if (input.cutoff && isPastCutoff(now, input.cutoff)) {
    // Let a repeat scan from someone already here see their status; only block new rows.
    const existing = await getCheckin(db, input.studentId, input.meetingId);
    if (existing) return { status: existing.checkedOutAt ? "already_checked_out" : "already_checked_in", checkin: existing };
    return { status: "past_cutoff" };
  }

  let deviceUsedByOtherStudent = false;
  if (input.deviceId) {
    const others = await db
      .select({ id: checkins.id })
      .from(checkins)
      .where(
        and(
          eq(checkins.meetingId, input.meetingId),
          eq(checkins.deviceId, input.deviceId),
          ne(checkins.studentId, input.studentId),
        ),
      )
      .limit(1);
    deviceUsedByOtherStudent = others.length > 0;
  }

  const flags = computeCheckinFlags({
    ip: input.ip,
    schoolIpRanges: input.schoolIpRanges,
    deviceId: input.deviceId,
    deviceUsedByOtherStudent,
  });

  const inserted = await db
    .insert(checkins)
    .values({
      studentId: input.studentId,
      meetingId: input.meetingId,
      checkedInAt: now,
      ip: input.ip,
      deviceId: input.deviceId,
      flags,
    })
    .onConflictDoNothing({ target: [checkins.studentId, checkins.meetingId] })
    .returning();

  if (inserted.length === 0) {
    const existing = await getCheckin(db, input.studentId, input.meetingId);
    if (!existing) throw new Error("check-in conflict but no existing row");
    return {
      status: existing.checkedOutAt ? "already_checked_out" : "already_checked_in",
      checkin: existing,
    };
  }

  if (deviceUsedByOtherStudent && input.deviceId) {
    // Flag the other student(s) on this device too, so both rows show up for review.
    await db
      .update(checkins)
      .set({ flags: appendFlag(FLAG.sharedDevice) })
      .where(
        and(
          eq(checkins.meetingId, input.meetingId),
          eq(checkins.deviceId, input.deviceId),
          ne(checkins.studentId, input.studentId),
        ),
      );
  }

  return { status: "checked_in", checkin: inserted[0] };
}

export type CheckOutResult =
  | { status: "checked_out"; checkin: Checkin }
  | { status: "not_checked_in" | "already_checked_out" | "meeting_closed" };

/**
 * Check out of an open meeting. `viaScan=false` (button on /me) adds the
 * `self_checkout` flag so mentors can tell the two apart.
 */
export async function checkOut(
  db: AnyDb,
  input: { studentId: string; meetingId: string; viaScan: boolean; now?: Date },
): Promise<CheckOutResult> {
  const now = input.now ?? new Date();
  const meeting = await getMeeting(db, input.meetingId);
  if (!meeting || !meeting.isOpen) return { status: "meeting_closed" };

  const updated = await db
    .update(checkins)
    .set({
      checkedOutAt: sql`GREATEST(${now.toISOString()}::timestamptz, ${checkins.checkedInAt})`,
      ...(input.viaScan ? {} : { flags: appendFlag(FLAG.selfCheckout) }),
    })
    .where(
      and(
        eq(checkins.studentId, input.studentId),
        eq(checkins.meetingId, input.meetingId),
        isNull(checkins.checkedOutAt),
      ),
    )
    .returning();

  if (updated.length > 0) return { status: "checked_out", checkin: updated[0] };
  const existing = await getCheckin(db, input.studentId, input.meetingId);
  return { status: existing ? "already_checked_out" : "not_checked_in" };
}

export type OpenMeetingResult =
  | { status: "opened"; meeting: Meeting }
  | { status: "already_open"; meeting: Meeting }
  | { status: "no_current_season" | "past_cutoff" };

export async function openMeeting(
  db: AnyDb,
  input: { openedBy: string; notes?: string | null; type?: MeetingType; cutoff?: DailyCutoff | null; now?: Date },
): Promise<OpenMeetingResult> {
  const existing = await getOpenMeeting(db);
  if (existing) return { status: "already_open", meeting: existing };
  // A meeting opened after the daily cutoff would be auto-closed immediately.
  if (input.cutoff && isPastCutoff(input.now ?? new Date(), input.cutoff)) return { status: "past_cutoff" };
  const [season] = await db.select().from(seasons).where(eq(seasons.isCurrent, true)).limit(1);
  if (!season) return { status: "no_current_season" };
  try {
    const [meeting] = await db
      .insert(meetings)
      .values({
        seasonId: season.id,
        startsAt: input.now ?? new Date(),
        isOpen: true,
        openedBy: input.openedBy,
        notes: input.notes || null,
        type: input.type ?? "regular",
      })
      .returning();
    return { status: "opened", meeting };
  } catch (err) {
    // Lost a race with another mentor: the partial unique index allows one open meeting.
    if (pgErrorCode(err) === "23505") {
      const m = await getOpenMeeting(db);
      if (m) return { status: "already_open", meeting: m };
    }
    throw err;
  }
}

/**
 * Close a meeting: mark it closed with an end time, then check out everyone
 * still checked in at the meeting end (flag `auto_checkout`). The checkout
 * sweep is idempotent, so calling this again on a closed meeting is safe and
 * will catch any straggler rows.
 */
export async function closeMeeting(
  db: AnyDb,
  meetingId: string,
  now: Date = new Date(),
): Promise<{ closed: boolean; autoCheckedOut: number }> {
  const closedRows = await db
    .update(meetings)
    .set({ isOpen: false, endsAt: sql`COALESCE(${meetings.endsAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(meetings.id, meetingId), eq(meetings.isOpen, true)))
    .returning();

  const meeting = closedRows[0] ?? (await getMeeting(db, meetingId));
  if (!meeting) return { closed: false, autoCheckedOut: 0 };
  const endsAt = meeting.endsAt ?? now;

  const swept = await db
    .update(checkins)
    .set({
      checkedOutAt: sql`GREATEST(${endsAt.toISOString()}::timestamptz, ${checkins.checkedInAt})`,
      flags: appendFlag(FLAG.autoCheckout),
    })
    .where(and(eq(checkins.meetingId, meetingId), isNull(checkins.checkedOutAt)))
    .returning({ id: checkins.id });

  return { closed: closedRows.length > 0, autoCheckedOut: swept.length };
}

/** Admin: add a check-in for a student (flag `manual`). Fails if one already exists. */
export async function addManualCheckin(
  db: AnyDb,
  input: {
    studentId: string;
    meetingId: string;
    checkedInAt: Date;
    checkedOutAt: Date | null;
    adjustedBy: string;
    now?: Date;
  },
): Promise<{ status: "added"; checkin: Checkin } | { status: "exists" | "no_meeting" }> {
  const meeting = await getMeeting(db, input.meetingId);
  if (!meeting) return { status: "no_meeting" };
  const inserted = await db
    .insert(checkins)
    .values({
      studentId: input.studentId,
      meetingId: input.meetingId,
      checkedInAt: input.checkedInAt,
      checkedOutAt: input.checkedOutAt,
      flags: [FLAG.manual],
      manualAdjustedBy: input.adjustedBy,
      manualAdjustedAt: input.now ?? new Date(),
    })
    .onConflictDoNothing({ target: [checkins.studentId, checkins.meetingId] })
    .returning();
  return inserted.length ? { status: "added", checkin: inserted[0] } : { status: "exists" };
}

/** Admin: edit check-in/out times; records who adjusted and adds the `edited` flag. */
export async function editCheckinTimes(
  db: AnyDb,
  input: {
    checkinId: string;
    checkedInAt: Date;
    checkedOutAt: Date | null;
    adjustedBy: string;
    now?: Date;
  },
): Promise<Checkin | null> {
  const [row] = await db
    .update(checkins)
    .set({
      checkedInAt: input.checkedInAt,
      checkedOutAt: input.checkedOutAt,
      manualAdjustedBy: input.adjustedBy,
      manualAdjustedAt: input.now ?? new Date(),
      flags: appendFlag(FLAG.edited),
    })
    .where(eq(checkins.id, input.checkinId))
    .returning();
  return row ?? null;
}

export async function deleteCheckin(db: AnyDb, checkinId: string): Promise<boolean> {
  const rows = await db.delete(checkins).where(eq(checkins.id, checkinId)).returning({ id: checkins.id });
  return rows.length > 0;
}

/** Make one season current. Two statements: clear the old one, then set the new one. */
export async function setCurrentSeason(db: AnyDb, seasonId: string): Promise<void> {
  await db
    .update(seasons)
    .set({ isCurrent: false })
    .where(and(eq(seasons.isCurrent, true), not(eq(seasons.id, seasonId))));
  await db.update(seasons).set({ isCurrent: true }).where(eq(seasons.id, seasonId));
}

export type SweepResult = { meetingsClosed: number; checkinsClosed: number };

/**
 * Daily cutoff sweep (idempotent, safe to run on every request and from cron):
 *
 *  1. Any meeting still open past the cutoff of its start day is closed with
 *     `ends_at` = the cutoff, or the meeting's own `ends_at` if earlier. If it
 *     ended earlier than the cutoff, its open check-ins are closed at that end
 *     (flag `auto_checkout`, same as closing it by hand).
 *  2. Any check-in still open at the cutoff of its check-in's local day is
 *     closed at exactly that cutoff (flag `auto_checkout_9pm`), never earlier
 *     than its own check-in time.
 *
 * Only rows with `checked_out_at IS NULL` are touched, so earlier check-outs win.
 */
export async function sweepStaleCheckins(db: AnyDb, opts: { cutoff: DailyCutoff; now?: Date }): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const { cutoff } = opts;
  // Everything that started before this bound has already reached its cutoff:
  // after today's cutoff that's "now"; before it, the start of today (local).
  const bound = isPastCutoff(now, cutoff) ? now : dayRangeInTz(isoDateInTz(now, cutoff.tz), cutoff.tz).start;

  let meetingsClosed = 0;
  const stale = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.isOpen, true), lt(meetings.startsAt, bound)));
  for (const m of stale) {
    const dayCutoff = cutoffForDay(m.startsAt, cutoff);
    const endMs = Math.max(m.startsAt.getTime(), Math.min(m.endsAt?.getTime() ?? Infinity, dayCutoff.getTime()));
    const end = new Date(endMs);
    const closed = await db
      .update(meetings)
      .set({ isOpen: false, endsAt: end })
      .where(and(eq(meetings.id, m.id), eq(meetings.isOpen, true)))
      .returning({ id: meetings.id });
    if (!closed.length) continue;
    meetingsClosed += 1;
    if (endMs < dayCutoff.getTime()) {
      // Meeting ended before the cutoff: same behaviour as closing it by hand at its end time.
      await db
        .update(checkins)
        .set({
          checkedOutAt: sql`GREATEST(${end.toISOString()}::timestamptz, ${checkins.checkedInAt})`,
          flags: appendFlag(FLAG.autoCheckout),
        })
        .where(and(eq(checkins.meetingId, m.id), isNull(checkins.checkedOutAt), lt(checkins.checkedInAt, end)));
    }
  }

  const open = await db
    .select({ id: checkins.id, checkedInAt: checkins.checkedInAt })
    .from(checkins)
    .where(and(isNull(checkins.checkedOutAt), lt(checkins.checkedInAt, bound)));
  // Group by cutoff instant so each local day is one UPDATE.
  const byCutoff = new Map<number, string[]>();
  for (const c of open) {
    const at = cutoffForDay(c.checkedInAt, cutoff).getTime();
    if (at > now.getTime()) continue;
    byCutoff.set(at, [...(byCutoff.get(at) ?? []), c.id]);
  }
  let checkinsClosed = 0;
  for (const [at, ids] of byCutoff) {
    const rows = await db
      .update(checkins)
      .set({
        checkedOutAt: sql`GREATEST(${new Date(at).toISOString()}::timestamptz, ${checkins.checkedInAt})`,
        flags: appendFlag(FLAG.autoCheckout9pm),
      })
      .where(and(inArray(checkins.id, ids), isNull(checkins.checkedOutAt)))
      .returning({ id: checkins.id });
    checkinsClosed += rows.length;
  }
  return { meetingsClosed, checkinsClosed };
}
