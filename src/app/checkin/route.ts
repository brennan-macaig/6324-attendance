import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/checkin-token";
import { cookieBase, DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, isValidDeviceId, newDeviceId } from "@/lib/device";
import { env } from "@/lib/env";
import { createScanProof, SCAN_PROOF_COOKIE, SCAN_PROOF_TTL_SECONDS } from "@/lib/scan-proof";

/**
 * GET /checkin?m=<meetingId>&t=<token>   (the URL inside the kiosk QR code)
 *
 * Validates the rotating token immediately — BEFORE any login redirect — and
 * records a short-lived signed "scan proof" cookie. Then sends the browser to
 * /checkin/confirm, which handles sign-in (if needed) and the check-in/out
 * confirmation. This way the 30-60s token can't expire mid-login.
 *
 * No database access and no authentication needed here: the token itself is
 * the authorisation for setting the proof, and the proof only lets an
 * already-authenticated user check *themselves* in.
 */
const Query = z.object({
  m: z.uuid(),
  t: z.string().min(10).max(64),
});

export function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  const dest = new URL("/checkin/confirm", req.nextUrl.origin);

  let proof: string | null = null;
  if (!parsed.success) {
    dest.searchParams.set("error", "invalid");
  } else if (!verifyToken(env.checkinSecret, parsed.data.m, parsed.data.t).valid) {
    dest.searchParams.set("error", "expired");
  } else {
    proof = createScanProof(env.checkinSecret, parsed.data.m);
  }

  // 303 so the browser drops the token-bearing URL from the address bar quickly.
  const res = NextResponse.redirect(dest, 303);
  res.headers.set("Cache-Control", "no-store");
  if (proof) {
    res.cookies.set(SCAN_PROOF_COOKIE, proof, { ...cookieBase, maxAge: SCAN_PROOF_TTL_SECONDS });
  }
  if (!isValidDeviceId(req.cookies.get(DEVICE_COOKIE)?.value)) {
    res.cookies.set(DEVICE_COOKIE, newDeviceId(), { ...cookieBase, maxAge: DEVICE_COOKIE_MAX_AGE });
  }
  return res;
}
