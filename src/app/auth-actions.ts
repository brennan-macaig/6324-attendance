"use server";

import { signIn, signOut } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/authz";

export async function signInWithGoogle(fd: FormData) {
  const redirectTo = safeRedirectPath(String(fd.get("callbackUrl") ?? ""), "/");
  await signIn("google", { redirectTo });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
