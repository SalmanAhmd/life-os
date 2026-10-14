import { z } from "zod";

import { isDateOnly, parseTimeToMinutes } from "@/lib/dates";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/features/tasks/types";

const dateOnlySchema = z
  .string()
  .refine((value) => isDateOnly(value), "Use a valid date (YYYY-MM-DD)");

const optionalDateOnly = dateOnlySchema.nullish();

const timeSchema = z
  .string()
  .refine((value) => parseTimeToMinutes(value) !== null, "Use HH:mm format")
  .nullish();

export const recurrenceInputSchema = z
  .object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.number().int().min(1).max(365).default(1),
    byWeekday: z.array(z.number().int().min(0).max(6)).default([]),
    byMonthDay: z.number().int().min(1).max(31).nullish(),
    bySetPos: z.union([z.literal(-1), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
    byWeekdayForSetPos: z.number().int().min(0).max(6).nullish(),
    byMonth: z.number().int().min(1).max(12).nullish(),
    startDate: dateOnlySchema,
    endDate: optionalDateOnly,
    count: z.number().int().min(1).max(1000).nullish(),
    exclusions: z.array(dateOnlySchema).default([]),
  })
  .refine((value) => !(value.endDate && value.count), {
    message: "Provide either an end date or a maximum count, not both",
    path: ["endDate"],
  });

export const taskInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).nullish(),
  status: z.enum(TASK_STATUSES as [string, ...string[]]).default("TODO"),
  priority: z.enum(TASK_PRIORITIES as [string, ...string[]]).default("MEDIUM"),
  doDate: optionalDateOnly,
  dueDate: optionalDateOnly,
  startTime: timeSchema,
  endTime: timeSchema,
  estimatedMinutes: z.number().int().min(0).max(10_000).nullish(),
  actualMinutes: z.number().int().min(0).max(10_000).nullish(),
  lifeAreaId: z.string().nullish(),
  projectId: z.string().nullish(),
  parentTaskId: z.string().nullish(),
  tagIds: z.array(z.string()).default([]),
  recurrence: recurrenceInputSchema.nullish(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;

export const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
