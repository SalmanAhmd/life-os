"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createGoal, updateGoal } from "@/features/goals/actions";
import { type GoalInput, goalInputSchema } from "@/features/goals/schemas";
import type { GoalSummary } from "@/features/goals/queries";
import type { PickerOption } from "@/features/tasks/queries";

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  today,
  lifeAreas,
  projects,
  parentGoals,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalSummary | null;
  today: string;
  lifeAreas: PickerOption[];
  projects: PickerOption[];
  parentGoals: { id: string; title: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<GoalInput>({
    resolver: zodResolver(goalInputSchema),
    defaultValues: {
      title: "",
      description: "",
      timeframe: "MONTHLY",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      metricType: "MANUAL",
      startDate: today,
      targetDate: null,
      targetValue: null,
      currentValue: null,
      unit: "",
      parentGoalId: null,
      lifeAreaId: null,
      projectId: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (goal) {
      form.reset({
        id: goal.id,
        title: goal.title,
        description: goal.description ?? "",
        timeframe: goal.timeframe as GoalInput["timeframe"],
        status: goal.status as GoalInput["status"],
        priority: goal.priority as GoalInput["priority"],
        metricType: goal.metricType as GoalInput["metricType"],
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        unit: goal.unit ?? "",
        parentGoalId: goal.parentGoalId,
        lifeAreaId: goal.lifeArea?.id ?? null,
        projectId: goal.project?.id ?? null,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        timeframe: "MONTHLY",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        metricType: "MANUAL",
        startDate: today,
        targetDate: null,
        targetValue: null,
        currentValue: null,
        unit: "",
        parentGoalId: null,
        lifeAreaId: null,
        projectId: null,
      });
    }
  }, [open, goal, today, form]);

  function onSubmit(values: GoalInput) {
    startTransition(async () => {
      const result = goal ? await updateGoal(values) : await createGoal(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(goal ? "Goal updated" : "Goal created");
      onOpenChange(false);
    });
  }

  const metricType = form.watch("metricType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>Define an outcome and how you will measure it.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="e.g. Run a half marathon" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="timeframe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeframe</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NOT_STARTED">Not started</SelectItem>
                        <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="URGENT">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value}
                        clearable={false}
                        onChange={(date) => date && field.onChange(date)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? null} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="metricType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How is progress measured?</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MANUAL">Manually / by milestones</SelectItem>
                      <SelectItem value="TASK_BASED">By linked tasks</SelectItem>
                      <SelectItem value="NUMERIC">By a number</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {metricType === "NUMERIC" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? null : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value === "" ? null : Number(event.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="km, books…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="lifeAreaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Life area</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {lifeAreas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>
                            {area.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentGoalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent goal</FormLabel>
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {parentGoals
                          .filter((parent) => parent.id !== goal?.id)
                          .map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {goal ? "Save changes" : "Create goal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
