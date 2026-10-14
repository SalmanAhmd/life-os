"use client";

import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addMilestone,
  deleteMilestone,
  getGoalForEdit,
  linkTask,
  toggleMilestone,
  unlinkTask,
  updateGoalValue,
} from "@/features/goals/actions";
import type { GoalDetail } from "@/features/goals/queries";

export function GoalDetailDialog({
  goalId,
  open,
  onOpenChange,
  taskOptions,
}: {
  goalId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskOptions: { id: string; title: string }[];
}) {
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [linkTaskId, setLinkTaskId] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !goalId) return;
    setLoading(true);
    void getGoalForEdit(goalId).then((result) => {
      setLoading(false);
      if (result.ok && result.data) {
        setDetail(result.data);
        setValueDraft(String(result.data.currentValue ?? ""));
      }
    });
  }, [open, goalId]);

  function refresh() {
    if (!goalId) return;
    void getGoalForEdit(goalId).then((result) => {
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

  const unlinkedTasks = taskOptions.filter(
    (task) => !detail?.linkedTasks.some((linked) => linked.id === task.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail?.title ?? "Goal"}</DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            {detail ? (
              <>
                <span>{detail.status.replaceAll("_", " ").toLowerCase()}</span>
                <span>·</span>
                <span>{detail.progress}% complete</span>
                {detail.progressMethod !== "empty" ? (
                  <>
                    <span>·</span>
                    <span>by {detail.progressMethod}</span>
                  </>
                ) : null}
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

            {detail.metricType === "NUMERIC" && detail.targetValue ? (
              <div className="flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Current value</label>
                  <Input
                    type="number"
                    value={valueDraft}
                    onChange={(event) => setValueDraft(event.target.value)}
                    className="w-40"
                  />
                </div>
                <span className="text-muted-foreground pb-2 text-sm">
                  / {detail.targetValue} {detail.unit ?? ""}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    run(
                      () => updateGoalValue(detail.id, Number(valueDraft) || 0),
                      "Value updated",
                    )
                  }
                >
                  Update
                </Button>
              </div>
            ) : null}

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
                      onClick={() =>
                        run(() => toggleMilestone(milestone.id), "Milestone updated")
                      }
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
                    run(
                      () => addMilestone({ goalId: detail.id, title }),
                      "Milestone added",
                    );
                  }}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                Linked tasks ({detail.linkedTaskDoneCount}/{detail.linkedTaskCount})
              </h3>
              <ul className="flex flex-col gap-1">
                {detail.linkedTasks.map((task) => (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Unlink task"
                      onClick={() => run(() => unlinkTask(detail.id, task.id), "Task unlinked")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              {unlinkedTasks.length > 0 ? (
                <div className="flex gap-2">
                  <Select value={linkTaskId} onValueChange={setLinkTaskId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Link an existing task" />
                    </SelectTrigger>
                    <SelectContent>
                      {unlinkedTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="gap-1"
                    disabled={!linkTaskId || isPending}
                    onClick={() => {
                      const taskId = linkTaskId;
                      setLinkTaskId("");
                      run(() => linkTask({ goalId: detail.id, taskId }), "Task linked");
                    }}
                  >
                    <Plus className="size-4" />
                    Link
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Goal not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
