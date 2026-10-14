import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your account, preferences, and integrations.
        </p>
      </div>
      <SettingsTabs />
      <div className="flex-1">{children}</div>
    </div>
  );
}