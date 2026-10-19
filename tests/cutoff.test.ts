import { describe, expect, it } from "vitest";
import { cappedCheckout, cutoffForDay, formatCutoff, isPastCutoff, makeCutoff, parseCutoffTime } from "@/lib/cutoff";
import { checkinDurationMs, summarizeByStudent } from "@/lib/hours";

const NY = makeCutoff("America/New_York", "21:00");
const d = (s: string) => new Date(s);

describe("parseCutoffTime / makeCutoff", () => {
  it("parses HH:MM and rejects junk", () => {
    expect(parseCutoffTime("21:00")).toEqual({ hour: 21, minute: 0 });
    expect(parseCutoffTime(" 9:30 ")).toEqual({ hour: 9, minute: 30 });
    expect(parseCutoffTime("24:00")).toBeNull();
    expect(parseCutoffTime("21:60")).toBeNull();
    expect(parseCutoffTime("9pm")).toBeNull();
    expect(parseCutoffTime(undefined)).toBeNull();
  });
  it("defaults to 21:00", () => {
    expect(makeCutoff("UTC", undefined)).toEqual({ tz: "UTC", hour: 21, minute: 0 });
    expect(makeCutoff("UTC", "garbage")).toEqual({ tz: "UTC", hour: 21, minute: 0 });
    expect(makeCutoff("UTC", "20:15")).toEqual({ tz: "UTC", hour: 20, minute: 15 });
  });
  it("formats", () => {
    expect(formatCutoff(NY)).toBe("9:00 PM");
    expect(formatCutoff({ hour: 0, minute: 5 })).toBe("12:05 AM");
    expect(formatCutoff({ hour: 12, minute: 0 })).toBe("12:00 PM");
  });
});

describe("cutoffForDay (DST-safe)", () => {
  it("is 9 PM EDT (01:00Z next day) on a summer-time day", () => {
    expect(cutoffForDay(d("2026-10-19T22:00:00Z"), NY).toISOString()).toBe("2026-10-20T01:00:00.000Z");
  });
  it("is 9 PM EST (02:00Z next day) in winter", () => {
    expect(cutoffForDay(d("2026-12-01T23:00:00Z"), NY).toISOString()).toBe("2026-12-02T02:00:00.000Z");
  });
  it("spring-forward day (Mar 8 2026, 23h day) is 9 PM EDT", () => {
    // 10:00 EST on Mar 8 (before the 2 AM jump would be 01:30 EST = 06:30Z)
    expect(cutoffForDay(d("2026-03-08T06:30:00Z"), NY).toISOString()).toBe("2026-03-09T01:00:00.000Z");
    expect(cutoffForDay(d("2026-03-08T18:00:00Z"), NY).toISOString()).toBe("2026-03-09T01:00:00.000Z");
  });
  it("fall-back day (Nov 1 2026, 25h day) is 9 PM EST", () => {
    // 01:30 EDT (first pass) and 01:30 EST (second pass) are both on Nov 1.
    expect(cutoffForDay(d("2026-11-01T05:30:00Z"), NY).toISOString()).toBe("2026-11-02T02:00:00.000Z");
    expect(cutoffForDay(d("2026-11-01T06:30:00Z"), NY).toISOString()).toBe("2026-11-02T02:00:00.000Z");
  });
  it("the day before a DST change uses that day's offset", () => {
    expect(cutoffForDay(d("2026-03-07T23:00:00Z"), NY).toISOString()).toBe("2026-03-08T02:00:00.000Z"); // EST
    expect(cutoffForDay(d("2026-10-31T22:00:00Z"), NY).toISOString()).toBe("2026-11-01T01:00:00.000Z"); // EDT
  });
  it("late-evening UTC instants belong to the local day", () => {
    // 8:30 PM EST Dec 1 == 01:30Z Dec 2 -> still Dec 1's cutoff
    expect(cutoffForDay(d("2026-12-02T01:30:00Z"), NY).toISOString()).toBe("2026-12-02T02:00:00.000Z");
  });
});

describe("isPastCutoff", () => {
  it("flips at exactly the cutoff and resets at local midnight", () => {
    expect(isPastCutoff(d("2026-10-20T00:59:59Z"), NY)).toBe(false); // 8:59:59 PM EDT
    expect(isPastCutoff(d("2026-10-20T01:00:00Z"), NY)).toBe(true); // 9:00 PM
    expect(isPastCutoff(d("2026-10-20T03:59:00Z"), NY)).toBe(true); // 11:59 PM
    expect(isPastCutoff(d("2026-10-20T04:00:00Z"), NY)).toBe(false); // midnight, new day
  });
  it("handles both DST boundary days", () => {
    expect(isPastCutoff(d("2026-03-09T00:59:00Z"), NY)).toBe(false); // 8:59 PM EDT Mar 8
    expect(isPastCutoff(d("2026-03-09T01:00:00Z"), NY)).toBe(true);
    expect(isPastCutoff(d("2026-11-02T01:59:00Z"), NY)).toBe(false); // 8:59 PM EST Nov 1
    expect(isPastCutoff(d("2026-11-02T02:00:00Z"), NY)).toBe(true);
  });
});

describe("hours cap", () => {
  it("caps a session at 9 PM local of its check-in day", () => {
    // 6 PM -> 11 PM EDT, counted as 6 -> 9 PM
    const inAt = d("2026-10-19T22:00:00Z");
    const outAt = d("2026-10-20T03:00:00Z");
    expect(cappedCheckout(inAt, outAt, NY)!.toISOString()).toBe("2026-10-20T01:00:00.000Z");
    expect(checkinDurationMs(inAt, outAt, NY)).toBe(3 * 3_600_000);
    expect(checkinDurationMs(inAt, outAt)).toBe(5 * 3_600_000); // no cutoff = unchanged
  });
  it("leaves earlier check-outs and open sessions alone", () => {
    const inAt = d("2026-10-19T22:00:00Z");
    expect(checkinDurationMs(inAt, d("2026-10-20T00:30:00Z"), NY)).toBe(2.5 * 3_600_000);
    expect(cappedCheckout(inAt, null, NY)).toBeNull();
  });
  it("gives 0 for a session that started after the cutoff", () => {
    expect(checkinDurationMs(d("2026-10-20T01:30:00Z"), d("2026-10-20T02:30:00Z"), NY)).toBe(0);
  });
  it("caps correctly on the fall-back day (25h day)", () => {
    // Nov 1 2026: 6 PM EST = 23:00Z; out at midnight EST = 05:00Z Nov 2 -> capped at 02:00Z
    expect(checkinDurationMs(d("2026-11-01T23:00:00Z"), d("2026-11-02T05:00:00Z"), NY)).toBe(3 * 3_600_000);
  });
  it("caps correctly on the spring-forward day (23h day)", () => {
    // Mar 8 2026: 6 PM EDT = 22:00Z; out 11 PM EDT = 03:00Z Mar 9 -> capped at 01:00Z
    expect(checkinDurationMs(d("2026-03-08T22:00:00Z"), d("2026-03-09T03:00:00Z"), NY)).toBe(3 * 3_600_000);
  });
  it("applies inside summarizeByStudent", () => {
    const s = summarizeByStudent(
      [{ studentId: "a", meetingId: "m", checkedInAt: d("2026-10-19T22:00:00Z"), checkedOutAt: d("2026-10-20T03:00:00Z") }],
      NY,
    );
    expect(s.get("a")!.totalMs).toBe(3 * 3_600_000);
  });
});
