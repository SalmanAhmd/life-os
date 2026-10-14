import { z } from "zod";

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const profileInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(80).optional(),
  timezone: z.string().refine((val) => {
    try {
      return Intl.supportedValuesOf("timeZone").includes(val);
    } catch {
      return true;
    }
  }, "Invalid timezone"),
  image: z.string().url().or(z.literal("")).optional(),
});

export const preferencesInputSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  timeFormat: z.enum(["12h", "24h"]).default("24h"),
  defaultTaskView: z.enum(["list", "table", "board"]).default("list"),
  pointsPerTask: z.number().int().min(0).default(10),
  pointsPerHighPriority: z.boolean().default(true),
  highPriorityBonus: z.number().int().min(0).default(5),
  pointsPerHabit: z.number().int().min(0).default(5),
  pointsPerMilestone: z.number().int().min(0).default(25),
  perfectDayBonus: z.number().int().min(0).default(20),
  perfectDayEnabled: z.boolean().default(false),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(60),
});

export const scheduleInputSchema = z.object({
  saturdayRule: z.enum(["ALL_OFF", "ALTERNATE_OFF", "SECOND_FOURTH_OFF", "ALL_WORKING", "CUSTOM"]).default("ALL_OFF"),
  workingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  alternateSaturdayWeeks: z.number().int().min(2).default(2),
  alternateSaturdayAnchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  dayStart: timeStringSchema.default("08:00"),
  dayEnd: timeStringSchema.default("18:00"),
  holidays: z.array(holidaySchema).max(100).default([]),
  exceptionalWorkdays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100).default([]),
});

export const notificationsInputSchema = z.object({
  notifyInApp: z.boolean().default(true),
  notifyBrowser: z.boolean().default(false),
  dailyAgendaEnabled: z.boolean().default(false),
  dailyAgendaTime: timeStringSchema.default("07:30"),
  defaultReminderMinutes: z.number().int().min(0).max(1440).default(15),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type PreferencesInput = z.infer<typeof preferencesInputSchema>;
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export type NotificationsInput = z.infer<typeof notificationsInputSchema>;