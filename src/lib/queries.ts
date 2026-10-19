import { and, asc, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { checkins, meetings, seasons, users, type Checkin, type Meeting, type Role, type User } from "@/db/schema";
import type { AnyDb } from "@/db/types";
import type { DailyCutoff } from "./cutoff";
import { attendancePct, summarizeByStudent } from "./hours";
import { displayName } from "./names";

/** Read-side queries. Callers must authorise first. */

export async function getCurrentSeason(db: AnyDb) {
  const [s] = await db.select().from(seasons).where(eq(seasons.isCurrent, true)).limit(1);
  return s ?? null;
}

export async function listSeasons(db: AnyDb) {
  return db.select().from(seasons).orderBy(desc(seasons.startDate));
}

export async function getSeason(db: AnyDb, id: string) {
  const [s] = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  return s ?? null;
}

/** Resolve ?season=<id>, falling back to current, then most recent. */
export async function resolveSeason(db: AnyDb, requested: string | undefined | null) {
  const all = await listSeasons(db);
  const chosen =
    (requested && all.find((s) => s.id === requested)) || all.find((s) => s.isCurrent) || all[0] || null;
  return { seasons: all, season: chosen };
}

export type AttendeeRow = {
  checkin: Checkin;
  user: Pick<User, "id" | "name" | "email" | "role" | "image">;
};

const attendeeUserCols = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  image: users.image,
};

export async function meetingAttendees(db: AnyDb, meetingId: string): Promise<AttendeeRow[]> {
  return db
    .select({ checkin: checkins, user: attendeeUserCols })
    .from(checkins)
    .innerJoin(users, eq(users.id, checkins.studentId))
    .where(eq(checkins.meetingId, meetingId))
    .orderBy(desc(checkins.checkedInAt));
}

export async function listMeetings(db: AnyDb, seasonId: string) {
  const ms = await db
    .select()
    .from(meetings)
    .where(eq(meetings.seasonId, seasonId))
    .orderBy(desc(meetings.startsAt));
  const counts = new Map<string, { total: number; here: number }>();
  if (ms.length) {
    const rows = await db
      .select({ meetingId: checkins.meetingId, out: checkins.checkedOutAt })
      .from(checkins)
      .where(
        inArray(
          checkins.meetingId,
          ms.map((m) => m.id),
        ),
      );
    for (const r of rows) {
      const c = counts.get(r.meetingId) ?? { total: 0, here: 0 };
      c.total += 1;
      if (!r.out) c.here += 1;
      counts.set(r.meetingId, c);
    }
  }
  return ms.map((m) => ({ meeting: m, attendees: counts.get(m.id)?.total ?? 0, here: counts.get(m.id)?.here ?? 0 }));
}

export type RosterEntry = Pick<User, "id" | "name" | "email" | "role" | "image" | "active">;

export async function activeRoster(db: AnyDb, roles: Role[] = ["student"]): Promise<RosterEntry[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
          role: users.role,
      image: users.image,
      active: users.active,
    })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, roles)))
    .orderBy(asc(users.name), asc(users.email));
}

export type DayView = {
  meetings: Meeting[];
  /** Check-ins that started within the day. */
  checkins: AttendeeRow[];
  /** Active students with no check-in that day. */
  absent: RosterEntry[];
};

/** Everything that happened in [start, end) (team-timezone day boundaries). */
export async function dayView(db: AnyDb, range: { start: Date; end: Date }): Promise<DayView> {
  const [dayMeetings, rows, roster] = await Promise.all([
    db
      .select()
      .from(meetings)
      .where(and(gte(meetings.startsAt, range.start), lt(meetings.startsAt, range.end)))
      .orderBy(asc(meetings.startsAt)),
    db
      .select({ checkin: checkins, user: attendeeUserCols })
      .from(checkins)
      .innerJoin(users, eq(users.id, checkins.studentId))
      .where(and(gte(checkins.checkedInAt, range.start), lt(checkins.checkedInAt, range.end)))
      .orderBy(asc(checkins.checkedInAt)),
    activeRoster(db, ["student"]),
  ]);
  const present = new Set(rows.map((r) => r.user.id));
  return { meetings: dayMeetings, checkins: rows, absent: roster.filter((r) => !present.has(r.id)) };
}

export type SeasonRow = {
  user: RosterEntry;
  totalMs: number;
  meetingsAttended: number;
  inProgress: number;
  attendancePct: number;
  lastSeen: Date | null;
};

/**
 * Season-wide hours for every student. Meetings "held" = meetings in the season
 * that started on or before `now` (the attendance-% denominator).
 */
export async function seasonReport(
  db: AnyDb,
  seasonId: string,
  opts: { roles?: Role[]; now?: Date; cutoff?: DailyCutoff | null } = {},
): Promise<{ meetingsHeld: number; rows: SeasonRow[] }> {
  const now = opts.now ?? new Date();
  const roles = opts.roles ?? ["student"];
  const [held, spans, people] = await Promise.all([
    db
      .select({ id: meetings.id })
      .from(meetings)
      .where(and(eq(meetings.seasonId, seasonId), lte(meetings.startsAt, now))),
    db
      .select({
        studentId: checkins.studentId,
        meetingId: checkins.meetingId,
        checkedInAt: checkins.checkedInAt,
        checkedOutAt: checkins.checkedOutAt,
      })
      .from(checkins)
      .innerJoin(meetings, eq(meetings.id, checkins.meetingId))
      .where(eq(meetings.seasonId, seasonId)),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
              role: users.role,
        image: users.image,
        active: users.active,
      })
      .from(users)
      .where(inArray(users.role, roles)),
  ]);
  const summary = summarizeByStudent(spans, opts.cutoff);
  const rows: SeasonRow[] = [];
  for (const u of people) {
    const s = summary.get(u.id);
    // Hide inactive people who never attended this season.
    if (!u.active && !s) continue;
    rows.push({
      user: u,
      totalMs: s?.totalMs ?? 0,
      meetingsAttended: s?.meetingsAttended ?? 0,
      inProgress: s?.inProgress ?? 0,
      attendancePct: attendancePct(s?.meetingsAttended ?? 0, held.length),
      lastSeen: s?.lastSeen ?? null,
    });
  }
  return { meetingsHeld: held.length, rows };
}

/** Every meeting in a season with the given student's check-in (if any). */
export async function studentSeasonDetail(db: AnyDb, studentId: string, seasonId: string) {
  const [ms, cs] = await Promise.all([
    db.select().from(meetings).where(eq(meetings.seasonId, seasonId)).orderBy(desc(meetings.startsAt)),
    db
      .select({ checkin: checkins })
      .from(checkins)
      .innerJoin(meetings, eq(meetings.id, checkins.meetingId))
      .where(and(eq(checkins.studentId, studentId), eq(meetings.seasonId, seasonId))),
  ]);
  const byMeeting = new Map(cs.map((r) => [r.checkin.meetingId, r.checkin]));
  return ms.map((m) => ({ meeting: m, checkin: byMeeting.get(m.id) ?? null }));
}

export async function getUserById(db: AnyDb, id: string) {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

/** Map of user id -> display name, for "adjusted by" labels. */
export async function userNames(db: AnyDb, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, displayName(r)]));
}
