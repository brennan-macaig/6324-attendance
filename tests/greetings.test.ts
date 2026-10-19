import { describe, expect, it } from "vitest";
import { CHECKIN_LINES, CHECKOUT_LINES, confirmationMessage, greeting, milestoneFor, pickLine, timeOfDay } from "@/lib/greetings";

const NY = "America/New_York";
const H = 3_600_000;
// 2026-10-19 is EDT (UTC-4): local hh:mm == (hh+4):mm Z
const at = (hhmm: string) => new Date(`2026-10-19T${String(Number(hhmm.slice(0, 2)) + 4).padStart(2, "0")}:${hhmm.slice(3)}:00Z`);

describe("time of day (team timezone)", () => {
  it("switches at 12:00 and 17:00 local", () => {
    expect(timeOfDay(at("00:00"), NY)).toBe("morning");
    expect(timeOfDay(at("11:59"), NY)).toBe("morning");
    expect(timeOfDay(at("12:00"), NY)).toBe("afternoon");
    expect(timeOfDay(at("16:59"), NY)).toBe("afternoon");
    expect(timeOfDay(at("17:00"), NY)).toBe("evening");
    expect(timeOfDay(at("19:59"), NY)).toBe("evening");
  });
  it("uses the team timezone, not UTC", () => {
    // 15:00Z is 11:00 in New York but 15:00 in London
    expect(timeOfDay(new Date("2026-10-19T15:00:00Z"), NY)).toBe("morning");
    expect(timeOfDay(new Date("2026-10-19T15:00:00Z"), "Europe/London")).toBe("afternoon");
  });
  it("greets by first name", () => {
    expect(greeting(at("09:00"), NY, "Ben")).toBe("Good morning, Ben!");
    expect(greeting(at("13:00"), NY, "Ben")).toBe("Good afternoon, Ben!");
    expect(greeting(at("18:30"), NY, "Ben")).toBe("Good evening, Ben!");
    expect(greeting(at("18:30"), NY, " ")).toBe("Good evening!");
  });
});

describe("lines", () => {
  it("has 10-15 of each and picks stably by seed", () => {
    for (const list of [CHECKIN_LINES, CHECKOUT_LINES]) {
      expect(list.length).toBeGreaterThanOrEqual(10);
      expect(list.length).toBeLessThanOrEqual(15);
    }
    expect(pickLine(CHECKIN_LINES, "abc")).toBe(pickLine(CHECKIN_LINES, "abc"));
    const seen = new Set(Array.from({ length: 50 }, (_, i) => pickLine(CHECKIN_LINES, `seed-${i}`)));
    expect(seen.size).toBeGreaterThan(5);
  });
  it("check-in uses the check-in list; check-out the check-out list with session length", () => {
    const inMsg = confirmationMessage({ now: at("18:00"), tz: NY, firstName: "Ada", seed: "x", context: { kind: "in" } });
    expect(inMsg.greeting).toBe("Good evening, Ada!");
    expect(CHECKIN_LINES).toContain(inMsg.line);
    expect(inMsg.session).toBeNull();
    const outMsg = confirmationMessage({
      now: at("20:00"),
      tz: NY,
      firstName: "Ada",
      seed: "x",
      context: { kind: "out", sessionMs: 2.25 * H, seasonMsAfter: 10 * H, hoursTarget: 80 },
    });
    expect(CHECKOUT_LINES).toContain(outMsg.line);
    expect(outMsg.session).toBe("You put in 2h 15m today");
    expect(outMsg.milestone).toBeNull();
  });
});

describe("session line", () => {
  it("is omitted for sessions under a minute", () => {
    const msg = confirmationMessage({ now: at("20:00"), tz: NY, firstName: "A", seed: "s", context: { kind: "out", sessionMs: 30_000, seasonMsAfter: H } });
    expect(msg.session).toBeNull();
  });
});

describe("milestone precedence", () => {
  const out = (beforeH: number, sessionH: number, hoursTarget: number | null = 80) =>
    milestoneFor({ kind: "out", sessionMs: sessionH * H, seasonMsAfter: (beforeH + sessionH) * H, hoursTarget });

  it("first check-in of the season", () => {
    expect(milestoneFor({ kind: "in", firstOfSeason: true })?.kind).toBe("first");
    expect(milestoneFor({ kind: "in", firstOfSeason: false })).toBeNull();
  });
  it("crossing the target beats everything", () => {
    const m = out(78, 3);
    expect(m).toEqual({ kind: "target", text: "You hit 80 hours — minimum met! 🎉" });
    // Target 100 and the 100-hour milestone at once: target wins.
    expect(out(98, 3, 100)?.kind).toBe("target");
  });
  it("round-hour milestones when no target is crossed", () => {
    expect(out(23, 3)).toEqual({ kind: "hours", text: "You just passed 25 hours this season. Huge!" });
    expect(out(49, 2)?.text).toContain("50 hours");
    expect(out(99, 2, null)?.text).toContain("100 hours");
    // Crossing two at once reports the larger.
    expect(out(24, 30, null)?.text).toContain("50 hours");
  });
  it("no milestone when nothing is crossed or already past", () => {
    expect(out(30, 2)).toBeNull();
    expect(out(80, 2)).toBeNull(); // target already met before this session
    expect(out(25, 2)).toBeNull(); // landed exactly on 25 last time
    expect(milestoneFor({ kind: "out", sessionMs: 0, seasonMsAfter: 25 * H })).toBeNull();
  });
  it("milestone replaces the random line", () => {
    const msg = confirmationMessage({
      now: at("20:00"),
      tz: NY,
      firstName: "Ben",
      seed: "x",
      context: { kind: "out", sessionMs: 3 * H, seasonMsAfter: 81 * H, hoursTarget: 80 },
    });
    expect(msg.line).toBe("You hit 80 hours — minimum met! 🎉");
    expect(msg.session).toBe("You put in 3h today");
  });
});
