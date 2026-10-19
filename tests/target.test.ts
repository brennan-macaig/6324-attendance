import { describe, expect, it } from "vitest";
import { targetLabel, targetProgress, targetVisibleToStudents } from "@/lib/target";

const H = 3_600_000;

describe("targetProgress", () => {
  it("computes remaining and percent", () => {
    const p = targetProgress(52.5 * H, 80)!;
    expect(p).toMatchObject({ target: 80, hours: 52.5, remaining: 27.5, met: false });
    expect(p.pct).toBeCloseTo(65.625);
    expect(targetLabel(p)).toBe("52.5 / 80 hrs · 27.5 to go");
  });
  it("is met at or over the target, at display precision", () => {
    expect(targetProgress(80 * H, 80)!.met).toBe(true);
    expect(targetProgress(79.96 * H, 80)!.met).toBe(true); // shows as 80.0
    expect(targetProgress(79.94 * H, 80)!.met).toBe(false);
    const over = targetProgress(95 * H, 80)!;
    expect(over).toMatchObject({ remaining: 0, pct: 100, met: true });
    expect(targetLabel(over)).toBe("Minimum met ✓");
  });
  it("returns null without a target", () => {
    expect(targetProgress(10 * H, null)).toBeNull();
    expect(targetProgress(10 * H, 0)).toBeNull();
  });
});

describe("targetVisibleToStudents", () => {
  const season = { hoursTarget: 80, targetVisibleFrom: "2027-01-09" };
  it("hides progress before the visible-from date and shows it on/after", () => {
    expect(targetVisibleToStudents(season, "2027-01-08")).toBe(false);
    expect(targetVisibleToStudents(season, "2027-01-09")).toBe(true);
    expect(targetVisibleToStudents(season, "2027-03-01")).toBe(true);
  });
  it("shows immediately with no date, never with no target", () => {
    expect(targetVisibleToStudents({ hoursTarget: 80, targetVisibleFrom: null }, "2026-09-01")).toBe(true);
    expect(targetVisibleToStudents({ hoursTarget: null, targetVisibleFrom: null }, "2027-09-01")).toBe(false);
    expect(targetVisibleToStudents(null, "2027-09-01")).toBe(false);
  });
});
