import "server-only";

import { db } from "@/lib/db";
import { toScheduleConfig, type ScheduleConfig } from "@/features/settings/schedule-config";

export type { Holiday, ScheduleConfig } from "@/features/settings/schedule-config";

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

export async function getSchedule(userId: string): Promise<ScheduleConfig | null> {
  const sched = await db.scheduleSettings.findUnique({
    where: { userId },
  });
  return sched ? toScheduleConfig(sched) : null;
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
