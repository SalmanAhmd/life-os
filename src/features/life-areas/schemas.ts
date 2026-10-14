import { z } from "zod";

export const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

export const lifeAreaInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
  color: z.string().regex(HEX_COLOR, "Pick a valid color"),
  icon: z.string().trim().min(1).max(40),
  order: z.number().int().min(0).optional(),
});

export type LifeAreaInput = z.infer<typeof lifeAreaInputSchema>;

export const lifeAreaReorderSchema = z.object({
  ids: z.array(z.string()).min(1),
});
