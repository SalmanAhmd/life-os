import { z } from "zod";

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

/** Day-of-week numbers (0=Sun..6=Sat). */
export const WEEKDAY_DAYS = [1, 2, 3, 4, 5] as const; // Monday to Friday
export const WEEKEND_DAYS = [0, 6] as const; // Sunday and Saturday
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0] as const; // Monday-first display order

export type DayGroup = "weekday" | "weekend" | "all" | "custom";

export const blockInputSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1).max(80),
    description: z.string().optional(),
    category: z.string().optional(),
    color: z.string().optional(),
    start: timeStringSchema,
    end: timeStringSchema,
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one day"),
    taskId: z.string().optional(),
    lifeAreaId: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = data.start.split(":").map(Number);
      const end = data.end.split(":").map(Number);
      return start[0] * 60 + start[1] < end[0] * 60 + end[1];
    },
    { message: "End time must be after start time", path: ["end"] },
  );

export type BlockInput = z.infer<typeof blockInputSchema>;
