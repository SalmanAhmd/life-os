"use client";

import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  addMilestone,
  deleteMilestone,
  getProjectForEdit,
  toggleMilestone,
} from "@/features/projects/actions";
import type { ProjectDetail } from "@/features/projects/queries";

export function ProjectDetailDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    void getProjectForEdit(projectId).then((result) => {
      setLoading(false);
      if (result.ok && result.data) {
        setDetail(result.data);
      }
    });
  }, [open, projectId]);

  function refresh() {
    if (!projectId) return;
    void getProjectForEdit(projectId).then((result) => {
      if (result.ok && result.data) setDetail(result.data);
    });
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(message);
      refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail?.name ?? "Project"}</DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            {detail ? (
              <>
                <span>{detail.status.replaceAll("_", " ").toLowerCase()}</span>
                <span>·</span>
                <span>{detail.progress}% complete</span>
                <span>·</span>
                <span>
                  {detail.taskDoneCount}/{detail.taskCount} tasks
                </span>
              </>
            ) : (
              "Loading…"
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-6">
            <Progress value={detail.progress} />

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                Milestones ({detail.milestoneDoneCount}/{detail.milestoneCount})
              </h3>
              <ul className="flex flex-col gap-1">
                {detail.milestones.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="border-border/70 flex items-center gap-2 rounded-md border px-2 py-1.5"
                  >
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(() => toggleMilestone(milestone.id), "Milestone updated")}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border",
                        milestone.completed
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {milestone.completed ? <Check className="size-3" /> : null}
                    </button>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        milestone.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {milestone.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Delete milestone"
                      onClick={() => run(() => deleteMilestone(milestone.id), "Milestone deleted")}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a milestone"
                  value={newMilestone}
                  onChange={(event) => setNewMilestone(event.target.value)}
                />
                <Button
                  variant="outline"
                  className="gap-1"
                  disabled={!newMilestone.trim() || isPending}
                  onClick={() => {
                    const title = newMilestone.trim();
                    setNewMilestone("");
                    run(() => addMilestone({ projectId: detail.id, title }), "Milestone added");
                  }}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Tasks ({detail.tasks.length})</h3>
              {detail.tasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No tasks in this project.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {detail.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="border-border/70 flex items-center gap-2 rounded-md border px-2 py-1.5"
                    >
                      <span
                        className={cn(
                          "flex-1 text-sm",
                          task.status === "COMPLETED" && "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="text-muted-foreground text-xs capitalize">
                        {task.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <a href="/tasks">Go to tasks</a>
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
