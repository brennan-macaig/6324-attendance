import { msToHours } from "./hours";

/**
 * Season hours target (e.g. 80 hours). Students see progress toward it from
 * `targetVisibleFrom` (team-timezone date) on; before that, hours only.
 * Mentors/admins see met / not-met whenever a target is set.
 */

export type SeasonTarget = { hoursTarget: number | null; targetVisibleFrom: string | null };

export type TargetProgress = {
  target: number;
  hours: number;
  remaining: number;
  met: boolean;
  /** 0..100 */
  pct: number;
};

/** Round to one decimal, the same precision hours are displayed with. */
const round1 = (n: number) => Math.round(n * 10) / 10;

export function targetProgress(totalMs: number, target: number | null | undefined): TargetProgress | null {
  if (target === null || target === undefined || !Number.isFinite(target) || target <= 0) return null;
  const hours = round1(msToHours(totalMs));
  const met = hours >= target;
  return {
    target,
    hours,
    remaining: met ? 0 : round1(target - hours),
    met,
    pct: Math.min(100, (hours / target) * 100),
  };
}

/** Should students see progress toward the target today? (`today` = 'YYYY-MM-DD' in team tz) */
export function targetVisibleToStudents(season: SeasonTarget | null | undefined, today: string): boolean {
  if (!season || season.hoursTarget === null || !(season.hoursTarget > 0)) return false;
  return !season.targetVisibleFrom || today >= season.targetVisibleFrom;
}

/** "52.5 / 80 hrs · 27.5 to go" or "Minimum met ✓" */
export function targetLabel(p: TargetProgress): string {
  return p.met ? "Minimum met ✓" : `${fmt(p.hours)} / ${fmt(p.target)} hrs · ${fmt(p.remaining)} to go`;
}

export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
