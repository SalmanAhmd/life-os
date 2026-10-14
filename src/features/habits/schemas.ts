import { z } from "zod";

import { isDateOnly } from "@/lib/dates";
import { HEX_COLOR } from "@/features/life-areas/schemas";

export const habitInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(1000).nullish(),
  frequency: z.enum(["DAILY", "WEEKLY", "CUSTOM"]).default("DAILY"),
  targetPerPeriod: z.number().int().min(1).max(1000).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  unit: z.string().trim().max(24).nullish(),
  color: z.string().regex(HEX_COLOR, "Pick a valid color").default("#10b981"),
  icon: z.string().trim().min(1).max(40).default("check"),
  lifeAreaId: z.string().nullish(),
});

export const habitCheckInSchema = z.object({
  habitId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Invalid date"),
  value: z.number().min(0).max(100_000).optional(),
});

export type HabitInput = z.infer<typeof habitInputSchema>;
