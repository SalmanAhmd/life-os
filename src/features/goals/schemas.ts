import { z } from "zod";

import { isDateOnly } from "@/lib/dates";

const dateOnly = z.string().refine(isDateOnly, "Invalid date");

export const goalInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(4000).nullish(),
  timeframe: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).default("MONTHLY"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).default("IN_PROGRESS"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  metricType: z.enum(["MANUAL", "TASK_BASED", "HABIT_BASED", "NUMERIC"]).default("MANUAL"),
  startDate: dateOnly,
  targetDate: dateOnly.nullish(),
  targetValue: z.number().min(0).max(1_000_000_000).nullish(),
  currentValue: z.number().min(0).max(1_000_000_000).nullish(),
  unit: z.string().trim().max(24).nullish(),
  parentGoalId: z.string().nullish(),
  lifeAreaId: z.string().nullish(),
  projectId: z.string().nullish(),
});

export const milestoneInputSchema = z.object({
  id: z.string().optional(),
  goalId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(160),
  dueDate: dateOnly.nullish(),
});

export const goalTaskLinkSchema = z.object({
  goalId: z.string().min(1),
  taskId: z.string().min(1),
});

export type GoalInput = z.infer<typeof goalInputSchema>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;
