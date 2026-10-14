import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { getTimetableBoard } from "@/features/timetable/queries";
import { getSchedule } from "@/features/settings/queries";
import { listLifeAreas } from "@/features/life-areas/queries";
import { listTaskOptions } from "@/features/tasks/queries";
import { TimetableView } from "@/features/timetable/components/timetable-view";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [board, schedule, lifeAreas, taskOptionsRaw] = await Promise.all([
    getTimetableBoard(user.id),
    getSchedule(user.id),
    listLifeAreas(user.id),
    listTaskOptions(user.id),
  ]);

  const taskOptions = taskOptionsRaw.map((t) => ({ id: t.id, name: t.title }));

  const scheduleConfig = schedule
    ? {
        saturdayRule: schedule.saturdayRule,
        workingDays: schedule.workingDays,
        alternateSaturdayWeeks: schedule.alternateSaturdayWeeks,
        alternateSaturdayAnchor: schedule.alternateSaturdayAnchor,
        holidays: schedule.holidays,
        exceptionalWorkdays: schedule.exceptionalWorkdays,
        dayStartMinutes: schedule.dayStartMinutes,
        dayEndMinutes: schedule.dayEndMinutes,
      }
    : {
        saturdayRule: "ALL_OFF" as const,
        workingDays: [1, 2, 3, 4, 5],
        alternateSaturdayWeeks: 2,
        alternateSaturdayAnchor: null,
        holidays: [],
        exceptionalWorkdays: [],
        dayStartMinutes: 480,
        dayEndMinutes: 1080,
      };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Timetable</h1>
        <p className="text-muted-foreground text-sm">
          Plan your week with reusable templates and time blocks.
        </p>
      </div>
      <TimetableView
        templates={board.templates}
        assignments={board.assignments}
        scheduleConfig={scheduleConfig}
        today={today}
        lifeAreas={lifeAreas}
        taskOptions={taskOptions}
      />
    </div>
  );
}