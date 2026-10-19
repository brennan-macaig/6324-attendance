/**
 * Timezone helpers. All timestamps are stored in UTC; "days" and display are
 * computed in the team timezone (TEAM_TIMEZONE). Implemented with Intl only.
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz: string): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of `tz` from UTC at instant `date`, in ms (e.g. -4h for EDT). */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock time in `tz` to a UTC Date. For nonexistent times (DST
 * spring-forward gap) the result is shifted forward; ambiguous times resolve to
 * the earlier instant.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let result = guess - off1;
  const off2 = tzOffsetMs(new Date(result), tz);
  if (off2 !== off1) {
    const alt = guess - off2;
    // Prefer the candidate whose wall-clock round-trips; otherwise take the later one.
    const p = zonedParts(new Date(alt), tz);
    result = p.hour === hour && p.minute === minute ? alt : Math.max(result, alt);
  }
  return new Date(result);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string | undefined | null): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** 'YYYY-MM-DD' of the given instant in the team timezone. */
export function isoDateInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * UTC [start, end) of a calendar day in `tz`. Handles 23h/25h DST days because
 * the end is computed as the start of the following local day.
 */
export function dayRangeInTz(isoDate: string, tz: string): { start: Date; end: Date } {
  if (!isIsoDate(isoDate)) throw new Error(`Invalid date: ${isoDate}`);
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = zonedWallTimeToUtc(y, m, d, 0, 0, tz);
  const [y2, m2, d2] = addDays(isoDate, 1).split("-").map(Number);
  const end = zonedWallTimeToUtc(y2, m2, d2, 0, 0, tz);
  return { start, end };
}

/** Value for <input type="datetime-local"> in the team timezone. */
export function toDateTimeLocalValue(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  const p = zonedParts(date, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Parse a datetime-local value ("YYYY-MM-DDTHH:mm") as wall time in `tz`. */
export function fromDateTimeLocalValue(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (!isIsoDate(`${y}-${mo}-${d}`) || Number(h) > 23 || Number(mi) > 59) return null;
  return zonedWallTimeToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), tz, Number(s ?? 0));
}

export function formatTime(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDate(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return `${formatDate(date, tz)}, ${formatTime(date, tz)}`;
}

/** Format an ISO calendar date (no timezone math needed). */
export function formatIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Mon, Oct 19" (no year) for compact lists. */
export function formatShortDate(date: Date | null | undefined, tz: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(date);
}
