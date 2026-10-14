import { z } from "zod";

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const templateInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  dayType: z.enum(["weekday", "weekend", "custom"]).default("custom"),
  isDefault: z.boolean().default(false),
});

export const blockInputSchema = z.object({
  id: z.string().optional(),
  templateId: z.string(),
  title: z.string().min(1).max(80),
  description: z.string().optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  start: timeStringSchema,
  end: timeStringSchema,
  taskId: z.string().optional(),
  lifeAreaId: z.string().optional(),
}).refine((data) => {
  const start = data.start.split(":").map(Number);
  const end = data.end.split(":").map(Number);
  return start[0] * 60 + start[1] < end[0] * 60 + end[1];
}, { message: "End time must be after start time", path: ["end"] });

export const weekdayAssignmentSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  templateId: z.string().nullable(),
});

export type TemplateInput = z.infer<typeof templateInputSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type WeekdayAssignmentInput = z.infer<typeof weekdayAssignmentSchema>;