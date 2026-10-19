import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless rotating check-in tokens.
 *
 *   token = base64url( HMAC-SHA256(secret, `${meetingId}:${window}`) )[first 16 bytes]
 *   window = floor(nowMs / 1000 / WINDOW_SECONDS)
 *
 * A token is accepted for the current window and the immediately previous one,
 * so a displayed QR is usable for between 30 and 60 seconds. Nothing is stored.
 */

export const WINDOW_SECONDS = 30;
/** Number of HMAC bytes kept (128 bits is plenty for a 60s-lived token). */
const TOKEN_BYTES = 16;

export function windowFor(nowMs: number, windowSeconds = WINDOW_SECONDS): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}

/** Epoch ms at which the given window ends (i.e. the next one starts). */
export function windowEndsAt(window: number, windowSeconds = WINDOW_SECONDS): number {
  return (window + 1) * windowSeconds * 1000;
}

function hmac(secret: string, meetingId: string, window: number): Buffer {
  return createHmac("sha256", secret)
    .update(`${meetingId}:${window}`)
    .digest()
    .subarray(0, TOKEN_BYTES);
}

export function generateToken(
  secret: string,
  meetingId: string,
  nowMs: number = Date.now(),
): string {
  return hmac(secret, meetingId, windowFor(nowMs)).toString("base64url");
}

export type TokenCheck = { valid: true; window: number } | { valid: false };

/**
 * Validate a token for a meeting. Accepts the current and previous window.
 * Uses a constant-time comparison.
 */
export function verifyToken(
  secret: string,
  meetingId: string,
  token: string,
  nowMs: number = Date.now(),
): TokenCheck {
  if (typeof token !== "string" || token.length === 0 || token.length > 64) {
    return { valid: false };
  }
  let provided: Buffer;
  try {
    provided = Buffer.from(token, "base64url");
  } catch {
    return { valid: false };
  }
  if (provided.length !== TOKEN_BYTES) return { valid: false };

  const current = windowFor(nowMs);
  let matched: number | null = null;
  // Always compute both comparisons so timing doesn't reveal which window matched.
  for (const w of [current, current - 1]) {
    const expected = hmac(secret, meetingId, w);
    if (timingSafeEqual(expected, provided) && matched === null) matched = w;
  }
  return matched === null ? { valid: false } : { valid: true, window: matched };
}

export function buildCheckinUrl(baseUrl: string, meetingId: string, token: string): string {
  const url = new URL("/checkin", baseUrl);
  url.searchParams.set("m", meetingId);
  url.searchParams.set("t", token);
  return url.toString();
}
