"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createTask, updateTask } from "@/features/tasks/actions";
import {
  type RecurrenceInput,
  type TaskInput,
  taskInputSchema,
} from "@/features/tasks/schemas";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/types";
import type { TaskDetail, TaskFormOptions } from "@/features/tasks/queries";
import {
  RecurrenceEditor,
  emptyRecurrenceInput,
} from "@/features/tasks/components/recurrence-editor";

export interface TaskFormDefaults {
  doDate?: string | null;
  dueDate?: string | null;
  status?: TaskStatus;
  lifeAreaId?: string | null;
  projectId?: string | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  options,
  task,
  defaults,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TaskFormOptions;
  task?: TaskDetail | null;
  defaults?: TaskFormDefaults;
  today: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceInput>(
    emptyRecurrenceInput(defaults?.doDate ?? today),
  );

  const form = useForm<TaskInput>({
    resolver: zodResolver(taskInputSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      doDate: null,
      dueDate: null,
      startTime: null,
      endTime: null,
      estimatedMinutes: null,
      actualMinutes: null,
      lifeAreaId: null,
      projectId: null,
      parentTaskId: null,
      tagIds: [],
      recurrence: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      form.reset({
        id: task.taskId,
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        doDate: task.doDate,
        dueDate: task.dueDate,
        startTime: minutesToTime(task.startMinutes),
        endTime: minutesToTime(task.endMinutes),
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes,
        lifeAreaId: task.lifeArea?.id ?? null,
        projectId: task.project?.id ?? null,
        parentTaskId: task.parentTaskId,
        tagIds: task.tags.map((tag) => tag.id),
        recurrence: null,
      });
      setTagIds(task.tags.map((tag) => tag.id));
    } else {
      const def = emptyRecurrenceInput(defaults?.doDate ?? today);
      form.reset({
        title: "",
        description: "",
        status: defaults?.status ?? "TODO",
        priority: "MEDIUM",
        doDate: defaults?.doDate ?? null,
        dueDate: defaults?.dueDate ?? null,
        startTime: null,
        endTime: null,
        estimatedMinutes: null,
        actualMinutes: null,
        lifeAreaId: defaults?.lifeAreaId ?? null,
        projectId: defaults?.projectId ?? null,
        parentTaskId: null,
        tagIds: [],
        recurrence: null,
      });
      setTagIds([]);
      setRecurring(false);
      setRecurrence(def);
    }
  }, [open, task, defaults, today, form]);

  function toggleTag(id: string) {
    setTagIds((current) =>
      current.includes(id) ? current.filter((tag) => tag !== id) : [...current, id],
    );
  }

  function onSubmit(values: TaskInput) {
    startTransition(async () => {
      const payload: TaskInput = {
        ...values,
        tagIds,
        recurrence: recurring ? recurrence : null,
      };
      const result = task
        ? await updateTask({ ...payload, id: task.taskId })
        : await createTask(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(task ? "Task updated" : "Task created");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update the details of this task."
              : "Capture what needs doing and when."}
          </DialogDescription>
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
                    <Input autoFocus placeholder="What needs doing?" {...field} />
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Optional details" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
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
                        {TASK_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {TASK_PRIORITY_LABELS[priority as TaskPriority]}
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
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {TASK_STATUS_LABELS[status as TaskStatus]}
                          </SelectItem>
                        ))}
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
                name="doDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Do date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? null} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? null} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimate (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === "" ? null : Number(event.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
                        {options.lifeAreas.map((area) => (
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
                        {options.projects.map((project) => (
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
            </div>

            {!task && options.parentTasks.length > 0 ? (
              <FormField
                control={form.control}
                name="parentTaskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent task (makes this a subtask)</FormLabel>
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
                        {options.parentTasks.map((parent) => (
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
            ) : null}

            {options.tags.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {options.tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        tagIds.includes(tag.id)
                          ? "border-transparent text-white"
                          : "text-muted-foreground hover:bg-accent/60",
                      )}
                      style={
                        tagIds.includes(tag.id)
                          ? { backgroundColor: tag.color ?? "#64748b" }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <RecurrenceEditor
              enabled={recurring}
              onEnabledChange={setRecurring}
              value={recurrence}
              onChange={setRecurrence}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {task ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function minutesToTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
