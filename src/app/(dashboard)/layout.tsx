import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { requireUser } from "@/lib/auth/current-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <AppShell user={{ name: user.name, email: user.email, image: user.image }}>
      {children}
    </AppShell>
  );
}
