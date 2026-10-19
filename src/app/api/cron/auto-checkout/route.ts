import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { sweepStaleCheckins } from "@/lib/attendance";
import { env } from "@/lib/env";

/**
 * GET /api/cron/auto-checkout  (Vercel Cron, see vercel.json)
 *
 * Requires `Authorization: Bearer ${CRON_SECRET}`. Closes check-ins still open
 * at the daily cutoff (stamped at exactly the cutoff, whenever this runs) and
 * any meetings left open past it. Idempotent.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  // Fail closed when no secret is configured.
  if (!secret || !bearerMatches(req.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sweepStaleCheckins(db, { cutoff: env.dailyCutoff });
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

function bearerMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
