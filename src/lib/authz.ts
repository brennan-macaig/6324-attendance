import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type Role, type User } from "@/db/schema";
import { auth } from "./auth";

/**
 * Server-side authorisation. Every page, route handler and server action calls
 * one of these. The session only identifies the user; role/active come from the
 * database on every request.
 */

const RANK: Record<Role, number> = { student: 0, mentor: 1, admin: 2 };

export function hasRole(user: Pick<User, "role"> | null | undefined, min: Role): boolean {
  return !!user && RANK[user.role] >= RANK[min];
}

/** Current active user, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;
  const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!u || !u.active) return null;
  return u;
});

/** For pages: redirect to sign-in if not logged in; to home if role too low. */
export async function requirePageUser(min: Role = "student", callbackPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(callbackPath ? `/?callbackUrl=${encodeURIComponent(callbackPath)}` : "/");
  if (!hasRole(user, min)) redirect("/forbidden");
  return user;
}

export class AuthzError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions / route handlers: throws AuthzError. */
export async function requireRole(min: Role = "student"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError(401, "Not signed in");
  if (!hasRole(user, min)) throw new AuthzError(403, "Not allowed");
  return user;
}

/** Route-handler helper: returns a JSON error Response for AuthzError. */
export function authzErrorResponse(err: unknown): Response {
  if (err instanceof AuthzError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeRedirectPath(p: string | null | undefined, fallback = "/"): string {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return fallback;
  return p;
}

export function homeFor(user: Pick<User, "role">): string {
  return hasRole(user, "mentor") ? "/dashboard" : "/me";
}
