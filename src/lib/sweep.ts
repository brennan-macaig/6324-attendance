import "server-only";
import { db } from "@/db";
import { sweepStaleCheckins, type SweepResult } from "./attendance";
import { env } from "./env";

/**
 * Run the daily-cutoff sweep for the current request (check-in/out paths,
 * kiosk API, and dashboard / me / hours page loads), so state is correct even
 * if the cron job never fires. Never throws: a failed sweep must not break a
 * page; the next request (or the cron) will retry.
 */
export async function runSweep(now: Date = new Date()): Promise<SweepResult | null> {
  try {
    return await sweepStaleCheckins(db, { cutoff: env.dailyCutoff, now });
  } catch (err) {
    console.error("auto-checkout sweep failed", err);
    return null;
  }
}
