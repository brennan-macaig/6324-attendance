import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A short-lived signed value proving "this browser scanned a valid kiosk QR for
 * meeting X at time T". It is set as an httpOnly cookie by GET /checkin *before*
 * any login redirect, so the 30-60s QR token expiring during Google sign-in does
 * not matter. The check-in action requires a valid, unexpired proof.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */

export const SCAN_PROOF_COOKIE = "frc_scan";
export const SCAN_PROOF_TTL_SECONDS = 10 * 60;

export type ScanProof = { m: string; iat: number };

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(`scan-proof:${body}`).digest("base64url");
}

export function createScanProof(secret: string, meetingId: string, nowMs = Date.now()): string {
  const payload: ScanProof = { m: meetingId, iat: Math.floor(nowMs / 1000) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export function readScanProof(
  secret: string,
  value: string | undefined | null,
  nowMs = Date.now(),
  ttlSeconds = SCAN_PROOF_TTL_SECONDS,
): ScanProof | null {
  if (!value || value.length > 512) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(secret, body));
  const provided = Buffer.from(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ScanProof;
    if (typeof payload.m !== "string" || typeof payload.iat !== "number") return null;
    const age = Math.floor(nowMs / 1000) - payload.iat;
    if (age < -30 || age > ttlSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
