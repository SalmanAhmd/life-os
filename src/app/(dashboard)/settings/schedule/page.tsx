import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { getSchedule } from "@/features/settings/queries";
import { ScheduleForm } from "@/features/settings/components/schedule-form";

export const metadata: Metadata = { title: "Schedule" };

export default async function ScheduleSettingsPage() {
  const user = await requireUser();
  const sched = await getSchedule(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-muted-foreground text-sm">
          Working days, holidays, and daily time bounds.
        </p>
      </div>
      <ScheduleForm
        defaultValues={{
          saturdayRule: sched?.saturdayRule ?? "ALL_OFF",
          workingDays: sched?.workingDays ?? [1, 2, 3, 4, 5],
          alternateSaturdayWeeks: sched?.alternateSaturdayWeeks ?? 2,
          alternateSaturdayAnchor: sched?.alternateSaturdayAnchor ?? null,
          dayStart: sched ? formatMinutes(sched.dayStartMinutes) : "08:00",
          dayEnd: sched ? formatMinutes(sched.dayEndMinutes) : "18:00",
          holidays: sched?.holidays ?? [],
          exceptionalWorkdays: sched?.exceptionalWorkdays ?? [],
        }}
      />
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}