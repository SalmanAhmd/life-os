import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This file must NOT import Prisma, bcrypt, or any Node-only module: it is used
 * by `middleware.ts`, which runs on the Edge runtime. The database adapter and
 * the credential provider are added in `src/lib/auth/auth.ts` (Node runtime).
 */
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    /** Used by middleware to gate the authenticated app shell. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

      if (isAuthPage) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }

      // Public landing page. Signed-in users are sent to their dashboard.
      if (pathname === "/") {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
