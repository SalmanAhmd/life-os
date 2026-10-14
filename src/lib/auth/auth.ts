import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth/config";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { signInSchema } from "@/features/auth/schemas";

/**
 * Full Auth.js configuration (Node runtime).
 *
 * Decision: **Auth.js (NextAuth v5)** with the Credentials provider is used
 * instead of Clerk.
 *  - It is self-hostable with no third-party service or external keys, which
 *    matches the "own your data" goal of a personal life OS.
 *  - Sessions are stateless JWTs, so `middleware.ts` can gate routes on the
 *    Edge runtime without touching the database.
 *  - The Prisma adapter is wired in so OAuth providers can be added later
 *    without a schema change (the Account/VerificationToken tables exist).
 *
 * Passwords are hashed with bcrypt (cost 12). All other auth surface (session
 * expiry, CSRF, cookie flags) is handled by Auth.js defaults.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = signInSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
