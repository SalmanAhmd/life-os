import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { listLifeAreas } from "@/features/life-areas/queries";
import { LifeAreasManager } from "@/features/life-areas/components/life-areas-manager";

export const metadata: Metadata = { title: "Life areas" };

export default async function LifeAreasSettingsPage() {
  const user = await requireUser();
  const areas = await listLifeAreas(user.id, { includeArchived: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Life areas</h1>
        <p className="text-muted-foreground text-sm">
          Group tasks, goals, habits and notes by the parts of life they belong to.
        </p>
      </div>
      <LifeAreasManager areas={areas} />
    </div>
  );
}
