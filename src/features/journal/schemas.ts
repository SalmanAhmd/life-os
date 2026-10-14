import { z } from "zod";

import { isDateOnly } from "@/lib/dates";

const dateOnly = z.string().refine(isDateOnly, "Invalid date");

export const journalEntryInputSchema = z.object({
  id: z.string().optional(),
  date: dateOnly,
  title: z.string().trim().max(200).nullish(),
  body: z.string().max(50_000).default(""),
  mood: z.enum(["GREAT", "GOOD", "OKAY", "LOW", "BAD"]).nullish(),
  gratitude: z.string().trim().max(4000).nullish(),
  isPrivate: z.boolean().default(true),
  tagIds: z.array(z.string()).default([]),
});

export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;
