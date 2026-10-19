"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { checkins, roleEnum, users } from "@/db/schema";
import { fail, formObject, guard, ok, revalidateAll, type ActionState } from "@/lib/actions";
import { requireRole } from "@/lib/authz";
import { env } from "@/lib/env";
import { parseBulkRoster } from "@/lib/roster";

const Email = z.email("Invalid email").transform((e) => e.trim().toLowerCase());
const optText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null));

function checkDomain(email: string): string | null {
  const d = env.allowedEmailDomain;
  return d && email.split("@")[1] !== d ? `${email} is not an @${d} address` : null;
}

/** Admin: add (or reactivate) one person. */
export async function addUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const input = z
      .object({
        email: Email,
        name: optText(120),
        role: z.enum(roleEnum.enumValues).default("student"),
      })
      .parse(formObject(fd));
    const domainErr = checkDomain(input.email);
    if (domainErr) return fail(domainErr);
    const inserted = await db.insert(users).values(input).onConflictDoNothing({ target: users.email }).returning();
    if (!inserted.length) return fail(`${input.email} is already on the roster.`);
    revalidateAll();
    return ok(`Added ${input.email}.`);
  });
}

/** Admin: paste many emails (one per line; optional "email, Name"). */
export async function bulkAddAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    await requireRole("admin");
    const { text } = z.object({ text: z.string().max(50_000) }).parse(formObject(fd));
    const { entries, invalid } = parseBulkRoster(text);
    const domainBad = entries.filter((e) => checkDomain(e.email));
    const good = entries.filter((e) => !checkDomain(e.email));
    let added = 0;
    if (good.length) {
      const rows = await db
        .insert(users)
        .values(good.map((e) => ({ email: e.email, name: e.name, role: "student" as const })))
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      added = rows.length;
    }
    revalidateAll();
    const parts = [`Added ${added}.`];
    if (good.length - added) parts.push(`${good.length - added} already on roster.`);
    if (invalid.length) parts.push(`Skipped invalid: ${invalid.slice(0, 5).join(", ")}${invalid.length > 5 ? "…" : ""}.`);
    if (domainBad.length) parts.push(`Skipped ${domainBad.length} outside @${env.allowedEmailDomain}.`);
    return { ok: invalid.length === 0 && domainBad.length === 0, message: parts.join(" ") };
  });
}

/**
 * Admin: change name / role / active. Admins can't demote or deactivate themselves.
 * A blank name keeps the current one (student names aren't pre-filled in the
 * roster form, so their full last names aren't shown).
 */
export async function updateUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const admin = await requireRole("admin");
    const input = z
      .object({
        userId: z.uuid(),
        name: optText(120),
        role: z.enum(roleEnum.enumValues),
        active: z.enum(["true", "false"]).transform((v) => v === "true"),
      })
      .parse(formObject(fd));
    if (input.userId === admin.id && (input.role !== "admin" || !input.active)) {
      return fail("You can't remove your own admin access or deactivate yourself.");
    }
    const rows = await db
      .update(users)
      .set({ ...(input.name ? { name: input.name } : {}), role: input.role, active: input.active })
      .where(eq(users.id, input.userId))
      .returning({ id: users.id });
    if (!rows.length) return fail("User not found.");
    revalidateAll();
    return ok("Saved.");
  });
}

/** Admin: permanently delete someone with no attendance history (otherwise deactivate). */
export async function deleteUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const admin = await requireRole("admin");
    const { userId } = z.object({ userId: z.uuid() }).parse(formObject(fd));
    if (userId === admin.id) return fail("You can't delete yourself.");
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(checkins)
      .where(eq(checkins.studentId, userId));
    if (n > 0) return fail("This person has attendance history. Deactivate them instead so their hours are kept.");
    await db.delete(users).where(eq(users.id, userId));
    revalidateAll();
    return ok("Deleted.");
  });
}
