import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { getProfile } from "@/features/settings/queries";
import { ProfileForm } from "@/features/settings/components/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Your name, timezone, and avatar.
        </p>
      </div>
      <ProfileForm
        defaultValues={{
          id: user.id,
          name: profile?.name ?? "",
          timezone: profile?.timezone ?? "UTC",
          image: profile?.image ?? "",
        }}
      />
    </div>
  );
}