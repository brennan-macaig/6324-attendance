import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthzError } from "./authz";

/** Shape returned by every form server action (consumed by <ActionForm>). */
export type ActionState = { ok: boolean; message: string } | null;

export const ok = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

/**
 * Wrap a server action body: converts auth errors and zod errors into a
 * friendly ActionState instead of a crash page.
 */
export async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    // Let Next.js control-flow errors (redirect/notFound) propagate.
    unstable_rethrow(err);
    if (err instanceof AuthzError) return fail(err.status === 401 ? "Please sign in again." : "You don't have permission to do that.");
    if (err instanceof z.ZodError) return fail(err.issues.map((i) => i.message).join("; "));
    console.error(err);
    return fail("Something went wrong. Please try again.");
  }
}

export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** All pages are dynamic and per-user; after a mutation just re-render everything. */
export function revalidateAll() {
  revalidatePath("/", "layout");
}
