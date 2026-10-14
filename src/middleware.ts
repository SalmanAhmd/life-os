import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/config";

/**
 * Edge middleware that gates the application shell.
 *
 * Security note: middleware is a convenience redirect, NOT the security
 * boundary. Every server action, route handler and data-access function also
 * verifies the session and scopes queries by `userId` (see
 * src/lib/auth/current-user.ts).
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|_next/data|favicon.ico|.*\\..*).*)"],
};
