import type { Metadata } from "next";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  return <SignInForm callbackUrl={params.callbackUrl ?? "/dashboard"} />;
}
