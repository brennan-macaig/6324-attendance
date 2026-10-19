import "server-only";
import { makeCutoff, type DailyCutoff } from "./cutoff";

/**
 * Runtime configuration. Everything is read lazily (never at module load) so
 * `next build` works without any secrets or a database present.
 */

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

export const env = {
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    return url;
  },
  get checkinSecret(): string {
    const s = process.env.CHECKIN_SECRET;
    if (!s || s.length < 32) {
      throw new Error("CHECKIN_SECRET must be set to a random string of at least 32 characters");
    }
    return s;
  },
  get allowedEmailDomain(): string | null {
    const d = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
    return d ? d : null;
  },
  get adminEmails(): string[] {
    return list(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase());
  },
  get requireRoster(): boolean {
    return bool(process.env.REQUIRE_ROSTER);
  },
  get schoolIpRanges(): string[] {
    return list(process.env.SCHOOL_IP_RANGES);
  },
  get teamTimezone(): string {
    return process.env.TEAM_TIMEZONE?.trim() || "America/New_York";
  },
  /** Daily automatic check-out time, team timezone ("HH:MM", default 21:00). */
  get dailyCutoff(): DailyCutoff {
    return makeCutoff(this.teamTimezone, process.env.DAILY_CHECKOUT_TIME);
  },
  /** Bearer secret for /api/cron/* (Vercel sends it automatically when set). */
  get cronSecret(): string | null {
    return process.env.CRON_SECRET?.trim() || null;
  },
  get teamName(): string {
    return process.env.TEAM_NAME?.trim() || "FRC Team";
  },
  /** Public base URL used inside QR codes. Falls back to Vercel's production URL. */
  get appUrl(): string | null {
    const explicit = process.env.APP_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, "");
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (vercel) return `https://${vercel}`;
    return null;
  },
};
