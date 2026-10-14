import { z } from "zod";

export const noteInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(200),
  body: z.string().max(50_000).default(""),
  format: z.enum(["MARKDOWN", "PLAIN"]).default("MARKDOWN"),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  lifeAreaId: z.string().nullish(),
  projectId: z.string().nullish(),
  tagIds: z.array(z.string()).default([]),
});

export type NoteInput = z.infer<typeof noteInputSchema>;
