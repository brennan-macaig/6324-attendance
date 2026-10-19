import { describe, expect, it } from "vitest";
import { decideSignIn } from "@/lib/signin-policy";

const base = {
  email: "kid@school.org",
  emailVerified: true,
  existing: null,
  allowedDomain: null,
  adminEmails: [],
  requireRoster: false,
};

describe("decideSignIn", () => {
  it("auto-creates unknown users when roster is not required", () => {
    expect(decideSignIn(base)).toEqual({ ok: true });
  });
  it("requires a verified email", () => {
    expect(decideSignIn({ ...base, emailVerified: false })).toEqual({ ok: false, reason: "unverified" });
  });
  it("enforces the allowed domain", () => {
    expect(decideSignIn({ ...base, allowedDomain: "school.org" }).ok).toBe(true);
    expect(decideSignIn({ ...base, email: "kid@gmail.com", allowedDomain: "school.org" })).toEqual({
      ok: false,
      reason: "domain",
    });
    // subdomain is not the same domain
    expect(decideSignIn({ ...base, email: "kid@evil.school.org", allowedDomain: "school.org" }).ok).toBe(false);
  });
  it("enforces roster membership when REQUIRE_ROSTER", () => {
    expect(decideSignIn({ ...base, requireRoster: true })).toEqual({ ok: false, reason: "roster" });
    expect(decideSignIn({ ...base, requireRoster: true, existing: { active: true } })).toEqual({ ok: true });
  });
  it("blocks deactivated users", () => {
    expect(decideSignIn({ ...base, existing: { active: false } })).toEqual({ ok: false, reason: "inactive" });
  });
  it("bootstraps ADMIN_EMAILS even with roster required, case-insensitively", () => {
    expect(
      decideSignIn({ ...base, email: "Coach@School.org", adminEmails: ["coach@school.org"], requireRoster: true }),
    ).toEqual({ ok: true, role: "admin" });
  });
  it("still enforces domain for admins", () => {
    expect(
      decideSignIn({ ...base, email: "coach@gmail.com", adminEmails: ["coach@gmail.com"], allowedDomain: "school.org" }).ok,
    ).toBe(false);
  });
});
