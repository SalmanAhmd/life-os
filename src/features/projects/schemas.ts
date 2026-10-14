import { z } from "zod";

import { isDateOnly } from "@/lib/dates";

const dateOnly = z.string().refine(isDateOnly, "Invalid date");

export const projectInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(160),
  description: z.string().trim().max(4000).nullish(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"]).default("ACTIVE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: dateOnly,
  targetDate: dateOnly.nullish(),
  lifeAreaId: z.string().nullish(),
});

export const projectMilestoneInputSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(160),
  dueDate: dateOnly.nullish(),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ProjectMilestoneInput = z.infer<typeof projectMilestoneInputSchema>;
