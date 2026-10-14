"use client";

import { ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { archiveProject, deleteProject, restoreProject, setProjectStatus } from "@/features/projects/actions";
import { ProjectDetailDialog } from "@/features/projects/components/project-detail-dialog";
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog";
import type { ProjectSummary } from "@/features/projects/queries";
import type { PickerOption } from "@/features/tasks/queries";

const STATUS_LABELS: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function ProjectsView({
  projects,
  today,
  lifeAreas,
}: {
  projects: ProjectSummary[];
  today: string;
  lifeAreas: PickerOption[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSummary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const activeProjects = projects.filter((p) => !p.archivedAt);
  const archivedProjects = projects.filter((p) => p.archivedAt);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openDetail(project: ProjectSummary) {
    setDetailId(project.id);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="mt-2 font-medium">No projects yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create a project to organize tasks and track progress.
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
            <Plus className="size-4" />
            New project
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {activeProjects.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {activeProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => openDetail(project)}
                  onEdit={() => {
                    setEditing(project);
                    setFormOpen(true);
                  }}
                />
              ))}
            </ul>
          )}

          {archivedProjects.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-muted-foreground text-sm font-medium">Archived</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {archivedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => openDetail(project)}
                    onEdit={() => {
                      setEditing(project);
                      setFormOpen(true);
                    }}
                    archived
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
        today={today}
        lifeAreas={lifeAreas}
      />

      <ProjectDetailDialog
        projectId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onEdit,
  archived = false,
}: {
  project: ProjectSummary;
  onOpen: () => void;
  onEdit: () => void;
  archived?: boolean;
}) {
  const [, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(message);
    });
  }

  return (
    <li className="border-border/70 bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{STATUS_LABELS[project.status] ?? project.status}</span>
            <span>·</span>
            <span>{PRIORITY_LABELS[project.priority] ?? project.priority}</span>
            {project.lifeArea ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: project.lifeArea.color }}
                  />
                  {project.lifeArea.name}
                </span>
              </>
            ) : null}
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Project actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            {!archived && project.status !== "COMPLETED" ? (
              <DropdownMenuItem
                onSelect={() => run(() => setProjectStatus(project.id, "COMPLETED"), "Project completed")}
              >
                Mark complete
              </DropdownMenuItem>
            ) : null}
            {!archived ? (
              <DropdownMenuItem onSelect={() => run(() => archiveProject(project.id), "Project archived")}>
                <ArchiveRestore className="size-4" />
                Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => run(() => restoreProject(project.id), "Project restored")}>
                <ArchiveRestore className="size-4" />
                Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => run(() => deleteProject(project.id), "Project deleted")}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-col gap-2">
        <Progress value={project.progress} />
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>
            {project.taskDoneCount}/{project.taskCount} tasks · {project.milestoneDoneCount}/
            {project.milestoneCount} milestones
          </span>
          <span>{project.progress}%</span>
        </div>
      </div>
    </li>
  );
}
