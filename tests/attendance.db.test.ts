/**
 * Integration tests for the attendance data layer against an in-process
 * Postgres (PGlite) using the real generated migration. No network needed.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/db/types";
import {
  addManualCheckin,
  checkIn,
  checkOut,
  closeMeeting,
  editCheckinTimes,
  openMeeting,
  setCurrentSeason,
  sweepStaleCheckins,
} from "@/lib/attendance";
import { makeCutoff } from "@/lib/cutoff";
import { dayView, seasonReport, studentSeasonDetail } from "@/lib/queries";
import { dayRangeInTz } from "@/lib/time";

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

let db: AnyDb;
let seasonId: string;
let mentorId: string;
let alice: string;
let bob: string;

beforeEach(async () => {
  db = await freshDb();
  const [season] = await db
    .insert(schema.seasons)
    .values({ name: "2026", startDate: "2026-01-01", endDate: "2026-12-31", isCurrent: true })
    .returning();
  seasonId = season.id;
  const people = await db
    .insert(schema.users)
    .values([
      { email: "mentor@x.org", name: "Mentor", role: "mentor" },
      { email: "alice@x.org", name: "Alice" },
      { email: "bob@x.org", name: "Bob" },
      { email: "carol@x.org", name: "Carol" },
    ])
    .returning();
  [mentorId, alice, bob] = people.map((p) => p.id);
});

const T = (iso: string) => new Date(iso);

describe("meetings", () => {
  it("allows only one open meeting", async () => {
    const a = await openMeeting(db, { openedBy: mentorId, now: T("2026-10-19T22:00:00Z") });
    expect(a.status).toBe("opened");
    const b = await openMeeting(db, { openedBy: mentorId });
    expect(b.status).toBe("already_open");
  });

  it("requires a current season", async () => {
    await db.update(schema.seasons).set({ isCurrent: false });
    expect((await openMeeting(db, { openedBy: mentorId })).status).toBe("no_current_season");
  });

  it("switches current season", async () => {
    const [s2] = await db
      .insert(schema.seasons)
      .values({ name: "2027", startDate: "2027-01-01", endDate: "2027-12-31" })
      .returning();
    await setCurrentSeason(db, s2.id);
    const current = await db.select().from(schema.seasons).where(eq(schema.seasons.isCurrent, true));
    expect(current.map((s) => s.id)).toEqual([s2.id]);
  });
});

describe("check-in / check-out", () => {
  it("is idempotent and toggles state", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId, now: T("2026-10-19T22:00:00Z") });
    if (opened.status !== "opened") throw new Error();
    const m = opened.meeting.id;
    const base = { studentId: alice, meetingId: m, ip: "10.0.0.5", deviceId: "dev-a", schoolIpRanges: ["10.0.0.0/8"] };

    const first = await checkIn(db, { ...base, now: T("2026-10-19T22:05:00Z") });
    expect(first.status).toBe("checked_in");
    if (first.status === "checked_in") expect(first.checkin.flags).toEqual([]);

    const again = await checkIn(db, { ...base, now: T("2026-10-19T22:06:00Z") });
    expect(again.status).toBe("already_checked_in");

    const out = await checkOut(db, { studentId: alice, meetingId: m, viaScan: true, now: T("2026-10-20T00:05:00Z") });
    expect(out.status).toBe("checked_out");

    expect((await checkIn(db, base)).status).toBe("already_checked_out");
    expect((await checkOut(db, { studentId: alice, meetingId: m, viaScan: true })).status).toBe("already_checked_out");
    expect((await checkOut(db, { studentId: bob, meetingId: m, viaScan: true })).status).toBe("not_checked_in");

    const rows = await db.select().from(schema.checkins);
    expect(rows).toHaveLength(1);
    expect(rows[0].checkedOutAt!.getTime() - rows[0].checkedInAt.getTime()).toBe(2 * 3_600_000);
  });

  it("flags off-network and shared devices on both students", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId });
    if (opened.status !== "opened") throw new Error();
    const m = opened.meeting.id;
    await checkIn(db, { studentId: alice, meetingId: m, ip: "8.8.8.8", deviceId: "phone-1", schoolIpRanges: ["10.0.0.0/8"] });
    const r = await checkIn(db, { studentId: bob, meetingId: m, ip: "10.1.1.1", deviceId: "phone-1", schoolIpRanges: ["10.0.0.0/8"] });
    expect(r.status === "checked_in" && r.checkin.flags).toEqual(["shared_device"]);
    const rows = await db.select().from(schema.checkins);
    const a = rows.find((x) => x.studentId === alice)!;
    expect(a.flags.sort()).toEqual(["off_network", "shared_device"]);
  });

  it("self checkout adds a flag", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId });
    if (opened.status !== "opened") throw new Error();
    await checkIn(db, { studentId: alice, meetingId: opened.meeting.id, ip: null, deviceId: "d", schoolIpRanges: [] });
    const out = await checkOut(db, { studentId: alice, meetingId: opened.meeting.id, viaScan: false });
    expect(out.status === "checked_out" && out.checkin.flags).toEqual(["self_checkout"]);
  });

  it("rejects check-in to a closed meeting", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId });
    if (opened.status !== "opened") throw new Error();
    await closeMeeting(db, opened.meeting.id);
    const r = await checkIn(db, { studentId: alice, meetingId: opened.meeting.id, ip: null, deviceId: "d", schoolIpRanges: [] });
    expect(r.status).toBe("meeting_closed");
  });
});

describe("closing + hours", () => {
  it("auto-checks-out open check-ins at meeting end and computes hours", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId, now: T("2026-10-19T22:00:00Z") });
    if (opened.status !== "opened") throw new Error();
    const m = opened.meeting.id;
    await checkIn(db, { studentId: alice, meetingId: m, ip: null, deviceId: "a", schoolIpRanges: [], now: T("2026-10-19T22:00:00Z") });
    await checkIn(db, { studentId: bob, meetingId: m, ip: null, deviceId: "b", schoolIpRanges: [], now: T("2026-10-19T23:00:00Z") });
    await checkOut(db, { studentId: bob, meetingId: m, viaScan: true, now: T("2026-10-19T23:30:00Z") });

    const res = await closeMeeting(db, m, T("2026-10-20T01:00:00Z"));
    expect(res).toEqual({ closed: true, autoCheckedOut: 1 });
    // Idempotent
    expect(await closeMeeting(db, m, T("2026-10-20T05:00:00Z"))).toEqual({ closed: false, autoCheckedOut: 0 });

    const rows = await db.select().from(schema.checkins);
    const a = rows.find((r) => r.studentId === alice)!;
    expect(a.flags).toContain("auto_checkout");
    expect(a.checkedOutAt!.toISOString()).toBe("2026-10-20T01:00:00.000Z");

    const report = await seasonReport(db, seasonId, { now: T("2026-10-21T00:00:00Z") });
    expect(report.meetingsHeld).toBe(1);
    const byName = Object.fromEntries(report.rows.map((r) => [r.user.name, r]));
    expect(byName.Alice.totalMs).toBe(3 * 3_600_000);
    expect(byName.Bob.totalMs).toBe(0.5 * 3_600_000);
    expect(byName.Carol.totalMs).toBe(0);
    expect(byName.Carol.attendancePct).toBe(0);
    expect(byName.Alice.attendancePct).toBe(100);
    expect(byName.Mentor).toBeUndefined();
  });

  it("supports manual add + edit and records the adjuster", async () => {
    const opened = await openMeeting(db, { openedBy: mentorId, now: T("2026-10-19T22:00:00Z") });
    if (opened.status !== "opened") throw new Error();
    const m = opened.meeting.id;
    const added = await addManualCheckin(db, {
      studentId: alice,
      meetingId: m,
      checkedInAt: T("2026-10-19T22:00:00Z"),
      checkedOutAt: T("2026-10-19T23:00:00Z"),
      adjustedBy: mentorId,
    });
    expect(added.status).toBe("added");
    expect(
      (await addManualCheckin(db, { studentId: alice, meetingId: m, checkedInAt: T("2026-10-19T22:00:00Z"), checkedOutAt: null, adjustedBy: mentorId })).status,
    ).toBe("exists");
    if (added.status !== "added") throw new Error();
    const edited = await editCheckinTimes(db, {
      checkinId: added.checkin.id,
      checkedInAt: T("2026-10-19T22:00:00Z"),
      checkedOutAt: T("2026-10-20T00:00:00Z"),
      adjustedBy: mentorId,
    });
    expect(edited!.flags.sort()).toEqual(["edited", "manual"]);
    expect(edited!.manualAdjustedBy).toBe(mentorId);

    const detail = await studentSeasonDetail(db, alice, seasonId);
    expect(detail).toHaveLength(1);
    expect(detail[0].checkin?.id).toBe(added.checkin.id);
  });
});

describe("day view", () => {
  it("uses team-timezone day boundaries", async () => {
    // 9pm-11:30pm New York on Oct 19 == 01:00-03:30Z on Oct 20
    const opened = await openMeeting(db, { openedBy: mentorId, now: T("2026-10-20T01:00:00Z") });
    if (opened.status !== "opened") throw new Error();
    await checkIn(db, { studentId: alice, meetingId: opened.meeting.id, ip: null, deviceId: "a", schoolIpRanges: [], now: T("2026-10-20T01:10:00Z") });

    const oct19 = await dayView(db, dayRangeInTz("2026-10-19", "America/New_York"));
    expect(oct19.meetings).toHaveLength(1);
    expect(oct19.checkins.map((c) => c.user.name)).toEqual(["Alice"]);
    expect(oct19.absent.map((a) => a.name).sort()).toEqual(["Bob", "Carol"]);

    const oct20 = await dayView(db, dayRangeInTz("2026-10-20", "America/New_York"));
    expect(oct20.checkins).toHaveLength(0);
  });
});

describe("seasons", () => {
  it("defaults the hours target to 80 with no visible-from date", async () => {
    const [s] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, seasonId));
    expect(s.hoursTarget).toBe(80);
    expect(s.targetVisibleFrom).toBeNull();
    const [s2] = await db
      .update(schema.seasons)
      .set({ hoursTarget: 62.5, targetVisibleFrom: "2027-01-09" })
      .where(eq(schema.seasons.id, seasonId))
      .returning();
    expect(s2.hoursTarget).toBe(62.5);
    expect(s2.targetVisibleFrom).toBe("2027-01-09");
  });
});

describe("daily 9 PM cutoff", () => {
  const NY = makeCutoff("America/New_York", "21:00");
  const base = { ip: null, deviceId: "d", schoolIpRanges: [] as string[], cutoff: NY };

  async function openAt(iso: string) {
    const opened = await openMeeting(db, { openedBy: mentorId, now: T(iso) });
    if (opened.status !== "opened") throw new Error(opened.status);
    return opened.meeting.id;
  }

  it("rejects new check-ins at/after 9 PM local but not before", async () => {
    const m = await openAt("2026-10-19T22:00:00Z"); // 6 PM EDT
    expect((await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-10-20T00:59:00Z") })).status).toBe("checked_in");
    expect((await checkIn(db, { ...base, studentId: bob, meetingId: m, now: T("2026-10-20T01:00:00Z") })).status).toBe("past_cutoff");
    // Someone already checked in still gets their status on a re-scan.
    expect((await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-10-20T01:30:00Z") })).status).toBe("already_checked_in");
  });

  it("won't open a meeting after the cutoff", async () => {
    const r = await openMeeting(db, { openedBy: mentorId, cutoff: NY, now: T("2026-10-20T01:30:00Z") });
    expect(r.status).toBe("past_cutoff");
    expect((await openMeeting(db, { openedBy: mentorId, cutoff: NY, now: T("2026-10-19T23:00:00Z") })).status).toBe("opened");
  });

  it("sweeps open check-ins to exactly 9 PM and closes the meeting, idempotently", async () => {
    const m = await openAt("2026-10-19T22:00:00Z"); // 6 PM EDT
    await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-10-19T22:05:00Z") });
    await checkIn(db, { ...base, deviceId: "d2", studentId: bob, meetingId: m, now: T("2026-10-19T22:10:00Z") });
    await checkOut(db, { studentId: bob, meetingId: m, viaScan: true, now: T("2026-10-20T00:00:00Z") }); // left at 8 PM

    // Before 9 PM: nothing happens.
    expect(await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-10-20T00:59:00Z") })).toEqual({ meetingsClosed: 0, checkinsClosed: 0 });

    // Cron fires at 10:37 PM: stamps exactly 9 PM.
    expect(await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-10-20T02:37:00Z") })).toEqual({ meetingsClosed: 1, checkinsClosed: 1 });
    const rows = await db.select().from(schema.checkins);
    const a = rows.find((r) => r.studentId === alice)!;
    const b = rows.find((r) => r.studentId === bob)!;
    expect(a.checkedOutAt!.toISOString()).toBe("2026-10-20T01:00:00.000Z");
    expect(a.flags).toEqual(["auto_checkout_9pm"]);
    expect(b.checkedOutAt!.toISOString()).toBe("2026-10-20T00:00:00.000Z"); // earlier checkout wins
    expect(b.flags).toEqual([]);
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, m));
    expect(meeting.isOpen).toBe(false);
    expect(meeting.endsAt!.toISOString()).toBe("2026-10-20T01:00:00.000Z");

    // Running again (page load, next day's cron) changes nothing.
    expect(await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-10-21T02:00:00Z") })).toEqual({ meetingsClosed: 0, checkinsClosed: 0 });
  });

  it("runs correctly the next morning if the cron never fired", async () => {
    const m = await openAt("2026-12-01T23:00:00Z"); // 6 PM EST
    await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-12-01T23:30:00Z") });
    // 8 AM EST next day, first page load
    await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-12-02T13:00:00Z") });
    const [a] = await db.select().from(schema.checkins);
    expect(a.checkedOutAt!.toISOString()).toBe("2026-12-02T02:00:00.000Z"); // 9 PM EST
  });

  it("uses the meeting's own end time when it's earlier than 9 PM", async () => {
    const m = await openAt("2026-10-19T22:00:00Z");
    await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-10-19T22:05:00Z") });
    // Admin set an 8 PM end but nobody closed it.
    await db.update(schema.meetings).set({ endsAt: T("2026-10-20T00:00:00Z") }).where(eq(schema.meetings.id, m));
    expect(await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-10-20T02:00:00Z") })).toEqual({ meetingsClosed: 1, checkinsClosed: 0 });
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, m));
    expect(meeting.endsAt!.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    const [a] = await db.select().from(schema.checkins);
    expect(a.checkedOutAt!.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(a.flags).toEqual(["auto_checkout"]);
  });

  it("stamps 9 PM correctly on both DST boundary days", async () => {
    // Spring forward: Sun Mar 8 2026 (EST -> EDT). Season covers 2026.
    const spring = await openAt("2026-03-08T22:00:00Z"); // 6 PM EDT
    await checkIn(db, { ...base, studentId: alice, meetingId: spring, now: T("2026-03-08T22:10:00Z") });
    await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-03-09T03:00:00Z") });
    // Fall back: Sun Nov 1 2026 (EDT -> EST).
    const fall = await openAt("2026-11-01T23:00:00Z"); // 6 PM EST
    await checkIn(db, { ...base, studentId: alice, meetingId: fall, now: T("2026-11-01T23:10:00Z") });
    await sweepStaleCheckins(db, { cutoff: NY, now: T("2026-11-02T03:00:00Z") });

    const rows = await db.select().from(schema.checkins);
    const byMeeting = Object.fromEntries(rows.map((r) => [r.meetingId, r]));
    expect(byMeeting[spring].checkedOutAt!.toISOString()).toBe("2026-03-09T01:00:00.000Z"); // 9 PM EDT
    expect(byMeeting[fall].checkedOutAt!.toISOString()).toBe("2026-11-02T02:00:00.000Z"); // 9 PM EST
  });

  it("caps hours at 9 PM in the season report", async () => {
    const m = await openAt("2026-10-19T22:00:00Z"); // 6 PM EDT
    await checkIn(db, { ...base, studentId: alice, meetingId: m, now: T("2026-10-19T22:00:00Z") });
    // Closed by hand at 11 PM (no sweep ran first).
    await closeMeeting(db, m, T("2026-10-20T03:00:00Z"));
    const report = await seasonReport(db, seasonId, { now: T("2026-10-21T00:00:00Z"), cutoff: NY });
    expect(report.rows.find((r) => r.user.name === "Alice")!.totalMs).toBe(3 * 3_600_000);
  });
});
