import { describe, expect, it } from "vitest";
import {
  attendancePct,
  checkinDurationMs,
  formatDuration,
  formatHours,
  summarizeByStudent,
  type CheckinSpan,
} from "@/lib/hours";

const d = (s: string) => new Date(s);

describe("checkinDurationMs", () => {
  it("is checkout minus checkin", () => {
    expect(checkinDurationMs(d("2026-10-01T22:00:00Z"), d("2026-10-02T01:30:00Z"))).toBe(3.5 * 3_600_000);
  });
  it("is 0 when not checked out", () => {
    expect(checkinDurationMs(d("2026-10-01T22:00:00Z"), null)).toBe(0);
  });
  it("never goes negative", () => {
    expect(checkinDurationMs(d("2026-10-01T22:00:00Z"), d("2026-10-01T21:00:00Z"))).toBe(0);
  });
});

describe("summarizeByStudent", () => {
  const rows: CheckinSpan[] = [
    { studentId: "a", meetingId: "m1", checkedInAt: d("2026-10-01T22:00:00Z"), checkedOutAt: d("2026-10-02T00:00:00Z") },
    { studentId: "a", meetingId: "m2", checkedInAt: d("2026-10-03T14:00:00Z"), checkedOutAt: d("2026-10-03T19:15:00Z") },
    { studentId: "a", meetingId: "m3", checkedInAt: d("2026-10-05T22:00:00Z"), checkedOutAt: null },
    { studentId: "b", meetingId: "m1", checkedInAt: d("2026-10-01T22:30:00Z"), checkedOutAt: d("2026-10-01T23:00:00Z") },
  ];
  const s = summarizeByStudent(rows);

  it("sums only completed spans", () => {
    expect(s.get("a")!.totalMs).toBe((2 + 5.25) * 3_600_000);
    expect(s.get("b")!.totalMs).toBe(0.5 * 3_600_000);
  });
  it("counts distinct meetings attended including in-progress", () => {
    expect(s.get("a")!.meetingsAttended).toBe(3);
    expect(s.get("a")!.inProgress).toBe(1);
    expect(s.get("b")!.meetingsAttended).toBe(1);
  });
  it("tracks last seen", () => {
    expect(s.get("a")!.lastSeen).toEqual(d("2026-10-05T22:00:00Z"));
    expect(s.get("b")!.lastSeen).toEqual(d("2026-10-01T23:00:00Z"));
  });
  it("returns nothing for students with no checkins", () => {
    expect(s.get("c")).toBeUndefined();
    expect(summarizeByStudent([]).size).toBe(0);
  });
});

describe("formatting / attendance", () => {
  it("formats", () => {
    expect(formatHours(5.25 * 3_600_000)).toBe("5.3");
    expect(formatDuration(95 * 60_000)).toBe("1h 35m");
    expect(formatDuration(120 * 60_000)).toBe("2h");
    expect(formatDuration(5 * 60_000)).toBe("5m");
  });
  it("computes attendance percent", () => {
    expect(attendancePct(3, 4)).toBe(75);
    expect(attendancePct(0, 0)).toBe(0);
    expect(attendancePct(5, 4)).toBe(100);
  });
});
