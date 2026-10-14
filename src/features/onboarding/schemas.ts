import { z } from "zod";

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimezone, "Select a valid timezone"),
  weekStartsOn: z.number().int().min(0).max(6),
  timeFormat: z.enum(["12h", "24h"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
