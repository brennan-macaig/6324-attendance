import { describe, expect, it } from "vitest";
import {
  WINDOW_SECONDS,
  buildCheckinUrl,
  generateToken,
  verifyToken,
  windowEndsAt,
  windowFor,
} from "@/lib/checkin-token";
import { createScanProof, readScanProof, SCAN_PROOF_TTL_SECONDS } from "@/lib/scan-proof";

const SECRET = "test-secret-test-secret-test-secret-123";
const MEETING = "6f1c1d36-3c2b-4a4f-9d55-0f0e0d0c0b0a";
// A timestamp exactly at the start of a window
const T0 = 1_760_000_010_000 - (1_760_000_010_000 % (WINDOW_SECONDS * 1000));

describe("windows", () => {
  it("computes 30s windows", () => {
    expect(windowFor(T0)).toBe(T0 / 30_000);
    expect(windowFor(T0 + 29_999)).toBe(windowFor(T0));
    expect(windowFor(T0 + 30_000)).toBe(windowFor(T0) + 1);
    expect(windowEndsAt(windowFor(T0))).toBe(T0 + 30_000);
  });
});

describe("generateToken / verifyToken", () => {
  it("is deterministic within a window and url-safe", () => {
    const a = generateToken(SECRET, MEETING, T0);
    const b = generateToken(SECRET, MEETING, T0 + 29_000);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBe(22); // 16 bytes base64url
  });

  it("changes every window", () => {
    expect(generateToken(SECRET, MEETING, T0)).not.toBe(generateToken(SECRET, MEETING, T0 + 30_000));
  });

  it("accepts the current window", () => {
    const t = generateToken(SECRET, MEETING, T0);
    expect(verifyToken(SECRET, MEETING, t, T0 + 5_000)).toEqual({ valid: true, window: windowFor(T0) });
  });

  it("accepts the previous window (grace period)", () => {
    const t = generateToken(SECRET, MEETING, T0);
    expect(verifyToken(SECRET, MEETING, t, T0 + 30_000).valid).toBe(true);
    expect(verifyToken(SECRET, MEETING, t, T0 + 59_999).valid).toBe(true);
  });

  it("rejects tokens two or more windows old", () => {
    const t = generateToken(SECRET, MEETING, T0);
    expect(verifyToken(SECRET, MEETING, t, T0 + 60_000).valid).toBe(false);
    expect(verifyToken(SECRET, MEETING, t, T0 + 10 * 60_000).valid).toBe(false);
  });

  it("rejects tokens from the future", () => {
    const t = generateToken(SECRET, MEETING, T0 + 30_000);
    expect(verifyToken(SECRET, MEETING, t, T0).valid).toBe(false);
  });

  it("rejects tokens for another meeting or secret", () => {
    const t = generateToken(SECRET, MEETING, T0);
    expect(verifyToken(SECRET, "other-meeting", t, T0).valid).toBe(false);
    expect(verifyToken("another-secret-another-secret-another", MEETING, t, T0).valid).toBe(false);
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "abc", "!!!!", "a".repeat(200), generateToken(SECRET, MEETING, T0) + "AA"]) {
      expect(verifyToken(SECRET, MEETING, bad, T0).valid).toBe(false);
    }
  });

  it("builds the check-in URL", () => {
    const url = buildCheckinUrl("https://example.org", MEETING, "tok_-1");
    expect(url).toBe(`https://example.org/checkin?m=${MEETING}&t=tok_-1`);
  });
});

describe("scan proof cookie", () => {
  it("round-trips", () => {
    const v = createScanProof(SECRET, MEETING, T0);
    expect(readScanProof(SECRET, v, T0 + 1000)).toEqual({ m: MEETING, iat: Math.floor(T0 / 1000) });
  });

  it("expires", () => {
    const v = createScanProof(SECRET, MEETING, T0);
    expect(readScanProof(SECRET, v, T0 + (SCAN_PROOF_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it("rejects tampering", () => {
    const v = createScanProof(SECRET, MEETING, T0);
    const [, sig] = v.split(".");
    const forged = Buffer.from(JSON.stringify({ m: "x", iat: Math.floor(T0 / 1000) })).toString("base64url");
    expect(readScanProof(SECRET, `${forged}.${sig}`, T0)).toBeNull();
    expect(readScanProof("wrong-secret-wrong-secret-wrong-secret", v, T0)).toBeNull();
    expect(readScanProof(SECRET, "garbage", T0)).toBeNull();
    expect(readScanProof(SECRET, undefined, T0)).toBeNull();
  });
});
