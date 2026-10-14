"use client";

import { MoreHorizontal, Pencil, Plus, Target, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { deleteGoal, setGoalStatus } from "@/features/goals/actions";
import { GoalDetailDialog } from "@/features/goals/components/goal-detail-dialog";
import { GoalFormDialog } from "@/features/goals/components/goal-form-dialog";
import type { GoalSummary } from "@/features/goals/queries";
import type { PickerOption } from "@/features/tasks/queries";

const TIMEFRAME_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export function GoalsView({
  goals,
  today,
  lifeAreas,
  projects,
  parentGoals,
  taskOptions,
}: {
  goals: GoalSummary[];
  today: string;
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  parentGoals: { id: string; title: string }[];
  taskOptions: { id: string; title: string }[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalSummary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openDetail(goal: GoalSummary) {
    setDetailId(goal.id);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="border-border/60 bg-muted/30 flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <Target className="text-muted-foreground size-6" />
          <p className="mt-2 font-medium">No goals yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Set an outcome you want to reach and break it into milestones.
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-1">
            <Plus className="size-4" />
            New goal
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onOpen={() => openDetail(goal)}
              onEdit={() => {
                setEditing(goal);
                setFormOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editing}
        today={today}
        lifeAreas={lifeAreas}
        projects={projects}
        parentGoals={parentGoals}
      />

      <GoalDetailDialog
        goalId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        taskOptions={taskOptions}
      />
    </div>
  );
}

function GoalCard({
  goal,
  onOpen,
  onEdit,
}: {
  goal: GoalSummary;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();

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
          <p className="truncate text-sm font-medium">{goal.title}</p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{TIMEFRAME_LABELS[goal.timeframe] ?? goal.timeframe}</span>
            <span>·</span>
            <span className="capitalize">
              {goal.status.replaceAll("_", " ").toLowerCase()}
            </span>
            {goal.lifeArea ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: goal.lifeArea.color }}
                  />
                  {goal.lifeArea.name}
                </span>
              </>
            ) : null}
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Goal actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            {goal.status !== "COMPLETED" ? (
              <DropdownMenuItem
                onSelect={() => run(() => setGoalStatus(goal.id, "COMPLETED"), "Goal completed")}
              >
                Mark complete
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => run(() => setGoalStatus(goal.id, "IN_PROGRESS"), "Goal reopened")}
              >
                Reopen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => run(() => deleteGoal(goal.id), "Goal deleted")}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-left">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{goal.milestoneCount} milestones</span>
          <span className="font-medium">{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className={cn(isPending && "opacity-60")} />
      </button>
    </li>
  );
}
