"use server";

import { type ActionResult, fail, ok, zodFieldErrors } from "@/lib/action-result";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { provisionUser } from "@/features/onboarding/provision";
import { signUpSchema } from "@/features/auth/schemas";

export async function registerUser(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  }

  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return fail("An account with this email already exists.", {
      email: ["This email is already registered"],
    });
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash },
      select: { id: true },
    });
    userId = user.id;
  } catch {
    return fail("We could not create your account. Please try again.");
  }

  await provisionUser(userId);
  return ok(undefined);
}
