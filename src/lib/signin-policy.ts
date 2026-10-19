export type SignInDecision =
  | { ok: true; role?: "admin" }
  | { ok: false; reason: "unverified" | "domain" | "roster" | "inactive" };

/** Pure decision logic (no DB writes) for who may sign in. */
export function decideSignIn(input: {
  email: string;
  emailVerified: boolean;
  existing: { active: boolean } | null;
  allowedDomain: string | null;
  adminEmails: string[];
  requireRoster: boolean;
}): SignInDecision {
  const email = input.email.toLowerCase();
  if (!input.emailVerified) return { ok: false, reason: "unverified" };
  if (input.allowedDomain && email.split("@")[1] !== input.allowedDomain) return { ok: false, reason: "domain" };
  const isBootstrapAdmin = input.adminEmails.includes(email);
  if (input.existing && !input.existing.active && !isBootstrapAdmin) return { ok: false, reason: "inactive" };
  if (!input.existing && input.requireRoster && !isBootstrapAdmin) return { ok: false, reason: "roster" };
  return isBootstrapAdmin ? { ok: true, role: "admin" } : { ok: true };
}
