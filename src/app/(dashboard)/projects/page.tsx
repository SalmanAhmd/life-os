import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/current-user";
import { todayDateOnly } from "@/lib/dates";
import { ProjectsView } from "@/features/projects/components/projects-view";
import { listProjects } from "@/features/projects/queries";
import { listLifeAreas } from "@/features/life-areas/queries";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const today = todayDateOnly(user.timezone);

  const [projects, lifeAreas] = await Promise.all([
    listProjects(user.id, { includeArchived: true }),
    listLifeAreas(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-muted-foreground text-sm">
          Organize your work and track progress across related tasks.
        </p>
      </div>
      <ProjectsView projects={projects} today={today} lifeAreas={lifeAreas} />
    </div>
  );
}
