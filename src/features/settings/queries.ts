import "server-only";

import { db } from "@/lib/db";
import type { DateOnly } from "@/lib/dates";

export interface Holiday {
  date: DateOnly;
  name: string;
}

export interface ScheduleConfig {
  saturdayRule: "ALL_OFF" | "ALTERNATE_OFF" | "SECOND_FOURTH_OFF" | "ALL_WORKING" | "CUSTOM";
  workingDays: number[];
  alternateSaturdayWeeks: number;
  alternateSaturdayAnchor: DateOnly | null;
  dayStartMinutes: number;
  dayEndMinutes: number;
  holidays: Holiday[];
  exceptionalWorkdays: DateOnly[];
}

export interface PreferencesData {
  theme: string;
  weekStartsOn: number;
  timeFormat: string;
  defaultTaskView: string;
  pointsPerTask: number;
  pointsPerHighPriority: boolean;
  highPriorityBonus: number;
  pointsPerHabit: number;
  pointsPerMilestone: number;
  perfectDayBonus: number;
  perfectDayEnabled: boolean;
  notifyInApp: boolean;
  notifyBrowser: boolean;
  dailyAgendaEnabled: boolean;
  dailyAgendaTime: string;
  defaultReminderMinutes: number;
}

export interface ProfileData {
  name: string | null;
  email: string;
  timezone: string;
  image: string | null;
}

export async function getProfile(userId: string): Promise<ProfileData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, timezone: true, image: true },
  });
  return user;
}

export async function getPreferences(userId: string): Promise<PreferencesData | null> {
  const prefs = await db.userPreferences.findUnique({
    where: { userId },
    select: {
      theme: true,
      weekStartsOn: true,
      timeFormat: true,
      defaultTaskView: true,
      pointsPerTask: true,
      pointsPerHighPriority: true,
      highPriorityBonus: true,
      pointsPerHabit: true,
      pointsPerMilestone: true,
      perfectDayBonus: true,
      perfectDayEnabled: true,
      notifyInApp: true,
      notifyBrowser: true,
      dailyAgendaEnabled: true,
      dailyAgendaTime: true,
      defaultReminderMinutes: true,
    },
  });
  return prefs;
}

function parseJson<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return fallback;
  }
}

export async function getSchedule(userId: string): Promise<ScheduleConfig | null> {
  const sched = await db.scheduleSettings.findUnique({
    where: { userId },
  });
  if (!sched) return null;

  return {
    saturdayRule: sched.saturdayRule as ScheduleConfig["saturdayRule"],
    workingDays: sched.workingDays as number[],
    alternateSaturdayWeeks: sched.alternateSaturdayWeeks,
    alternateSaturdayAnchor: sched.alternateSaturdayAnchor as DateOnly | null,
    dayStartMinutes: sched.dayStartMinutes,
    dayEndMinutes: sched.dayEndMinutes,
    holidays: parseJson<Holiday[]>(sched.holidays, []),
    exceptionalWorkdays: parseJson<DateOnly[]>(sched.exceptionalWorkdays, []),
  };
}

export async function getNotificationPreferences(userId: string): Promise<PreferencesData | null> {
  const prefs = await db.userPreferences.findUnique({
    where: { userId },
    select: {
      theme: true,
      weekStartsOn: true,
      timeFormat: true,
      defaultTaskView: true,
      pointsPerTask: true,
      pointsPerHighPriority: true,
      highPriorityBonus: true,
      pointsPerHabit: true,
      pointsPerMilestone: true,
      perfectDayBonus: true,
      perfectDayEnabled: true,
      notifyInApp: true,
      notifyBrowser: true,
      dailyAgendaEnabled: true,
      dailyAgendaTime: true,
      defaultReminderMinutes: true,
    },
  });
  return prefs;
}