import { describe, expect, it } from "vitest";
import {
  addDays,
  dayRangeInTz,
  fromDateTimeLocalValue,
  isIsoDate,
  isoDateInTz,
  toDateTimeLocalValue,
  zonedWallTimeToUtc,
} from "@/lib/time";

const NY = "America/New_York";
const LA = "America/Los_Angeles";

describe("dayRangeInTz", () => {
  it("computes a normal EDT day", () => {
    const { start, end } = dayRangeInTz("2026-10-19", NY);
    expect(start.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-20T04:00:00.000Z");
  });
  it("computes a normal EST day", () => {
    const { start, end } = dayRangeInTz("2026-01-15", NY);
    expect(start.toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-16T05:00:00.000Z");
  });
  it("handles the 23-hour spring-forward day", () => {
    const { start, end } = dayRangeInTz("2026-03-08", NY);
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });
  it("handles the 25-hour fall-back day", () => {
    const { start, end } = dayRangeInTz("2026-11-01", NY);
    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(25 * 3_600_000);
  });
  it("works for UTC and other zones", () => {
    expect(dayRangeInTz("2026-06-01", "UTC").start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(dayRangeInTz("2026-06-01", LA).start.toISOString()).toBe("2026-06-01T07:00:00.000Z");
    expect(dayRangeInTz("2026-06-01", "Asia/Kolkata").start.toISOString()).toBe("2026-05-31T18:30:00.000Z");
  });
  it("rejects invalid dates", () => {
    expect(() => dayRangeInTz("2026-02-30", NY)).toThrow();
    expect(() => dayRangeInTz("nope", NY)).toThrow();
  });
});

describe("isoDateInTz", () => {
  it("uses the team timezone, not UTC, for the calendar day", () => {
    // 02:30 UTC on the 20th is still the evening of the 19th in New York
    const late = new Date("2026-10-20T02:30:00Z");
    expect(isoDateInTz(late, NY)).toBe("2026-10-19");
    expect(isoDateInTz(late, "UTC")).toBe("2026-10-20");
  });
  it("is consistent with dayRangeInTz", () => {
    const { start, end } = dayRangeInTz("2026-11-01", NY);
    expect(isoDateInTz(start, NY)).toBe("2026-11-01");
    expect(isoDateInTz(new Date(end.getTime() - 1), NY)).toBe("2026-11-01");
    expect(isoDateInTz(end, NY)).toBe("2026-11-02");
  });
});

describe("helpers", () => {
  it("isIsoDate", () => {
    expect(isIsoDate("2026-10-19")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
  it("addDays crosses months/years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("zonedWallTimeToUtc", () => {
    expect(zonedWallTimeToUtc(2026, 10, 19, 18, 30, NY).toISOString()).toBe("2026-10-19T22:30:00.000Z");
    // 02:30 does not exist on spring-forward day; result lands after the gap
    expect(zonedWallTimeToUtc(2026, 3, 8, 2, 30, NY).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-03-08T07:00:00Z").getTime(),
    );
  });
  it("datetime-local round trip", () => {
    const dt = new Date("2026-10-19T22:30:00Z");
    const v = toDateTimeLocalValue(dt, NY);
    expect(v).toBe("2026-10-19T18:30");
    expect(fromDateTimeLocalValue(v, NY)?.toISOString()).toBe(dt.toISOString());
    expect(fromDateTimeLocalValue("garbage", NY)).toBeNull();
    expect(fromDateTimeLocalValue("2026-02-30T10:00", NY)).toBeNull();
  });
});
