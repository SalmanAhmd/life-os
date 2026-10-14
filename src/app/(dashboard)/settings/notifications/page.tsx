import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { getNotificationPreferences } from "@/features/settings/queries";
import { NotificationsForm } from "@/features/settings/components/notifications-form";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsSettingsPage() {
  const user = await requireUser();
  const prefs = await getNotificationPreferences(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground text-sm">
          Control how and when you receive notifications.
        </p>
      </div>
      <NotificationsForm
        defaultValues={{
          notifyInApp: prefs?.notifyInApp ?? true,
          notifyBrowser: prefs?.notifyBrowser ?? false,
          dailyAgendaEnabled: prefs?.dailyAgendaEnabled ?? false,
          dailyAgendaTime: prefs?.dailyAgendaTime ?? "07:30",
          defaultReminderMinutes: prefs?.defaultReminderMinutes ?? 15,
        }}
      />
    </div>
  );
}