import { formatHours } from "./hours";
import { displayName } from "./names";
import { targetProgress } from "./target";

export const SORT_KEYS = ["name", "hours", "meetings", "pct", "last"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

type Sortable = {
  user: { name: string | null; email: string; role: string };
  totalMs: number;
  meetingsAttended: number;
  attendancePct: number;
  lastSeen: Date | null;
};

export function parseSort(key: unknown, dir: unknown): { key: SortKey; dir: SortDir } {
  const k = (SORT_KEYS as readonly string[]).includes(key as string) ? (key as SortKey) : "hours";
  const d: SortDir = dir === "asc" || dir === "desc" ? dir : k === "name" ? "asc" : "desc";
  return { key: k, dir: d };
}

export function sortRows<T extends Sortable>(rows: T[], key: SortKey, dir: SortDir): T[] {
  // Sort by what is displayed (students: "First L.").
  const name = (r: T) => displayName(r.user).toLowerCase();
  const cmp: Record<SortKey, (a: T, b: T) => number> = {
    name: (a, b) => name(a).localeCompare(name(b)),
    hours: (a, b) => a.totalMs - b.totalMs,
    meetings: (a, b) => a.meetingsAttended - b.meetingsAttended,
    pct: (a, b) => a.attendancePct - b.attendancePct,
    last: (a, b) => (a.lastSeen?.getTime() ?? 0) - (b.lastSeen?.getTime() ?? 0),
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * cmp[key](a, b) || name(a).localeCompare(name(b)));
}

/** CSV cell escaping, including spreadsheet formula-injection protection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Season CSV. Names use the display rule (students "First L."). When the
 * season has an hours target, "Target hours" and "Target met" columns are added.
 */
export function seasonCsv(
  rows: Sortable[],
  meetingsHeld: number,
  formatLastSeen: (d: Date | null) => string,
  opts: { hoursTarget?: number | null } = {},
): string {
  const target = opts.hoursTarget && opts.hoursTarget > 0 ? opts.hoursTarget : null;
  return toCsv([
    ["Name", "Email", "Role", "Hours", "Meetings attended", "Meetings held", "Attendance %", "Last seen", ...(target ? ["Target hours", "Target met"] : [])],
    ...rows.map((r) => [
      displayName(r.user),
      r.user.email,
      r.user.role,
      formatHours(r.totalMs, 2),
      r.meetingsAttended,
      meetingsHeld,
      r.attendancePct.toFixed(1),
      formatLastSeen(r.lastSeen),
      ...(target ? [target, targetProgress(r.totalMs, target)?.met ? "Yes" : "No"] : []),
    ]),
  ]);
}
