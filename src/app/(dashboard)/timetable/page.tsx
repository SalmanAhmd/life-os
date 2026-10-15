import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { getSchedule } from "@/features/settings/queries";
import { listLifeAreas } from "@/features/life-areas/queries";
import { listTaskOptions } from "@/features/tasks/queries";
import { listBlocks } from "@/features/timetable/queries";
import { TimetableView } from "@/features/timetable/components/timetable-view";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const user = await requireUser();

  const [blocks, schedule, lifeAreas, taskOptionsRaw] = await Promise.all([
    listBlocks(user.id),
    getSchedule(user.id),
    listLifeAreas(user.id),
    listTaskOptions(user.id),
  ]);

  const taskOptions = taskOptionsRaw.map((t) => ({ id: t.id, name: t.title }));

  return (
    <div className="flex flex-col gap-6">
      <TimetableView
        blocks={blocks}
        dayStartMinutes={schedule?.dayStartMinutes ?? 480}
        dayEndMinutes={schedule?.dayEndMinutes ?? 1080}
        lifeAreas={lifeAreas}
        taskOptions={taskOptions}
      />
    </div>
  );
}
