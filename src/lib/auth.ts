import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "./env";
import { decideSignIn } from "./signin-policy";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
  }
}

/**
 * Auth.js (next-auth v5): Google only, JWT sessions (no session table, no
 * adapter, serverless-friendly). The JWT carries only the user's DB id; role
 * and active status are re-read from the database on every request in
 * src/lib/authz.ts so role changes and deactivation take effect immediately.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
          // `hd` is only a UI hint for Google's account chooser; the domain is enforced below.
          ...(process.env.ALLOWED_EMAIL_DOMAIN ? { hd: process.env.ALLOWED_EMAIL_DOMAIN } : {}),
        },
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/", error: "/auth-error" },
  trustHost: true,
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return "/auth-error?reason=unverified";
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const decision = decideSignIn({
        email,
        emailVerified: profile?.email_verified === true,
        existing: existing ?? null,
        allowedDomain: env.allowedEmailDomain,
        adminEmails: env.adminEmails,
        requireRoster: env.requireRoster,
      });
      if (!decision.ok) return `/auth-error?reason=${decision.reason}`;

      const name = typeof profile?.name === "string" ? profile.name : null;
      const image = typeof profile?.picture === "string" ? profile.picture : null;
      await db
        .insert(users)
        .values({
          email,
          name,
          image,
          role: decision.role ?? "student",
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            // Keep an admin-entered roster name if present.
            name: sql`COALESCE(${users.name}, excluded.name)`,
            image: sql`excluded.image`,
            lastLoginAt: sql`excluded.last_login_at`,
            ...(decision.role === "admin" ? { role: "admin" as const, active: true } : {}),
          },
        });
      return true;
    },
    async jwt({ token, profile }) {
      // Only on initial sign-in: bind the token to our DB user id.
      if (profile?.email) {
        const [u] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, profile.email.toLowerCase()))
          .limit(1);
        if (u) token.uid = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      return session;
    },
  },
});
