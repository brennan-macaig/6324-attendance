/**
 * Hours / attendance math. Pure functions so they are easy to unit-test.
 *
 * Rules:
 *  - A check-in contributes (checkedOutAt - checkedInAt), clamped at 0.
 *  - Check-ins without a checkout contribute 0 to totals (they are "in
 *    progress"; closing the meeting auto-checks them out).
 *  - Attendance % = distinct meetings attended / meetings held in the period.
 *  - When a daily cutoff is given, a session never counts past the cutoff
 *    (e.g. 9:00 PM) of its check-in's local day (belt-and-braces for the
 *    automatic 9 PM check-out).
 */

import { cappedCheckout, type DailyCutoff } from "./cutoff";

export type CheckinSpan = {
  studentId: string;
  meetingId: string;
  checkedInAt: Date;
  checkedOutAt: Date | null;
};

export const MS_PER_HOUR = 3_600_000;

export function checkinDurationMs(checkedInAt: Date, checkedOutAt: Date | null, cutoff?: DailyCutoff | null): number {
  const out = cappedCheckout(checkedInAt, checkedOutAt, cutoff);
  if (!out) return 0;
  return Math.max(0, out.getTime() - checkedInAt.getTime());
}

/** Elapsed time for an in-progress check-in (for "here for 1h 20m" displays). */
export function elapsedMs(checkedInAt: Date, now: Date = new Date()): number {
  return Math.max(0, now.getTime() - checkedInAt.getTime());
}

export function msToHours(ms: number): number {
  return ms / MS_PER_HOUR;
}

export function formatHours(ms: number, digits = 1): string {
  return msToHours(ms).toFixed(digits);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type StudentSummary = {
  studentId: string;
  totalMs: number;
  meetingsAttended: number;
  inProgress: number;
  lastSeen: Date | null;
};

export function summarizeByStudent(checkins: CheckinSpan[], cutoff?: DailyCutoff | null): Map<string, StudentSummary> {
  const out = new Map<string, StudentSummary>();
  const meetingSets = new Map<string, Set<string>>();
  for (const c of checkins) {
    let s = out.get(c.studentId);
    if (!s) {
      s = { studentId: c.studentId, totalMs: 0, meetingsAttended: 0, inProgress: 0, lastSeen: null };
      out.set(c.studentId, s);
      meetingSets.set(c.studentId, new Set());
    }
    s.totalMs += checkinDurationMs(c.checkedInAt, c.checkedOutAt, cutoff);
    if (!c.checkedOutAt) s.inProgress += 1;
    meetingSets.get(c.studentId)!.add(c.meetingId);
    const seen = c.checkedOutAt ?? c.checkedInAt;
    if (!s.lastSeen || seen > s.lastSeen) s.lastSeen = seen;
  }
  for (const [id, set] of meetingSets) out.get(id)!.meetingsAttended = set.size;
  return out;
}

export function attendancePct(attended: number, held: number): number {
  if (held <= 0) return 0;
  return Math.min(100, (attended / held) * 100);
}
