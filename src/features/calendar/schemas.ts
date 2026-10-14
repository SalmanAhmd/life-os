import { z } from "zod";

import { isDateOnly, parseTimeToMinutes } from "@/lib/dates";
import { recurrenceInputSchema } from "@/features/tasks/schemas";

const dateOnlySchema = z
  .string()
  .refine((value) => isDateOnly(value), "Use a valid date (YYYY-MM-DD)");

const timeSchema = z
  .string()
  .refine((value) => parseTimeToMinutes(value) !== null, "Use HH:mm format")
  .nullish();

export const calendarEventInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(5000).nullish(),
    location: z.string().trim().max(200).nullish(),
    meetingUrl: z.string().trim().max(500).nullish(),
    date: dateOnlySchema,
    startTime: timeSchema,
    endTime: timeSchema,
    allDay: z.boolean().default(false),
    lifeAreaId: z.string().nullish(),
    recurrence: recurrenceInputSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.allDay) return;
    const start = value.startTime ? parseTimeToMinutes(value.startTime) : null;
    const end = value.endTime ? parseTimeToMinutes(value.endTime) : null;

    if (start == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["startTime"], message: "Start time is required" });
    }
    if (end == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time is required" });
    }
    if (start != null && end != null && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after the start time",
      });
    }
  });

export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>;
