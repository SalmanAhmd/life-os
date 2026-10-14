import type { DateOnly } from "@/lib/dates";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export type TaskView = "all" | "today" | "upcoming" | "overdue" | "completed";

export interface TaskItem {
  /** Unique per row: task id for simple tasks, occurrence id for occurrences. */
  id: string;
  taskId: string;
  occurrenceId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  doDate: DateOnly | null;
  dueDate: DateOnly | null;
  startMinutes: number | null;
  endMinutes: number | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  completedAt: string | null;
  isRecurring: boolean;
  seriesId: string | null;
  recurrenceLabel: string | null;
  parentTaskId: string | null;
  lifeArea: { id: string; name: string; color: string } | null;
  project: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
  subtaskCount: number;
  subtaskCompletedCount: number;
}

export interface TaskFilters {
  q?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  lifeAreaId?: string;
  projectId?: string;
  tagId?: string;
  view?: TaskView;
  from?: DateOnly;
  to?: DateOnly;
  dateField?: "doDate" | "dueDate";
}
