import { isoDateInTz, zonedWallTimeToUtc } from "./time";

/**
 * Daily check-out cutoff (DAILY_CHECKOUT_TIME, default 21:00, team timezone).
 *
 * Any check-in still open at the cutoff on its check-in day is closed at
 * exactly that wall-clock time; new check-ins after the cutoff are rejected;
 * and hours never count past it. Pure functions: DST is handled by computing
 * the cutoff as a wall-clock time on the check-in's local calendar day.
 */

export type DailyCutoff = { tz: string; hour: number; minute: number };

export const DEFAULT_CUTOFF_TIME = "21:00";

/** Parse "HH:MM" (24h). Returns null for anything invalid. */
export function parseCutoffTime(value: string | null | undefined): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function makeCutoff(tz: string, time: string | null | undefined): DailyCutoff {
  const parsed = parseCutoffTime(time) ?? parseCutoffTime(DEFAULT_CUTOFF_TIME)!;
  return { tz, ...parsed };
}

/** The cutoff instant on the local calendar day of `instant`. */
export function cutoffForDay(instant: Date, cutoff: DailyCutoff): Date {
  const [y, m, d] = isoDateInTz(instant, cutoff.tz).split("-").map(Number);
  return zonedWallTimeToUtc(y, m, d, cutoff.hour, cutoff.minute, cutoff.tz);
}

/** True once the local wall clock has reached the cutoff (until local midnight). */
export function isPastCutoff(now: Date, cutoff: DailyCutoff): boolean {
  return now.getTime() >= cutoffForDay(now, cutoff).getTime();
}

/**
 * Effective check-out time for hours math: the recorded checkout, capped at
 * the cutoff of the check-in's local day (never earlier than the check-in).
 * Open check-ins stay open (null).
 */
export function cappedCheckout(checkedInAt: Date, checkedOutAt: Date | null, cutoff: DailyCutoff | null | undefined): Date | null {
  if (!checkedOutAt || !cutoff) return checkedOutAt;
  const cap = cutoffForDay(checkedInAt, cutoff);
  if (checkedOutAt.getTime() <= cap.getTime()) return checkedOutAt;
  return new Date(Math.max(cap.getTime(), checkedInAt.getTime()));
}

/** "9:00 PM" style label for the cutoff. */
export function formatCutoff(cutoff: Pick<DailyCutoff, "hour" | "minute">): string {
  const h12 = cutoff.hour % 12 === 0 ? 12 : cutoff.hour % 12;
  return `${h12}:${String(cutoff.minute).padStart(2, "0")} ${cutoff.hour < 12 ? "AM" : "PM"}`;
}
