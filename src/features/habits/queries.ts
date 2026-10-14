import "server-only";

import { type DateOnly, addDays, dbDateToDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  type HabitDefinition,
  type HabitFrequency,
  completionRate,
  computeStreaks,
  isCompletedOn,
} from "@/lib/habits";

export interface HabitToday {
  habitId: string;
  date: DateOnly;
  value: number;
  target: number;
  done: boolean;
}

export interface HabitSummary {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  targetPerPeriod: number;
  weekdays: number[];
  unit: string | null;
  color: string;
  icon: string;
  isArchived: boolean;
  lifeArea: { id: string; name: string; color: string } | null;
  currentStreak: number;
  bestStreak: number;
  streakUnit: "day" | "week";
  completion30: number;
  todayValue: number;
  doneToday: boolean;
  recent: { date: DateOnly; value: number; done: boolean }[];
}

function toDefinition(habit: {
  frequency: string;
  weekdays: number[];
  targetPerPeriod: number;
  createdAt: Date;
}): HabitDefinition {
  return {
    frequency: habit.frequency as HabitFrequency,
    weekdays: habit.weekdays,
    targetPerPeriod: habit.targetPerPeriod,
    createdAt: dbDateToDateOnly(habit.createdAt),
  };
}

export async function listHabits(
  userId: string,
  today: DateOnly,
  options: { includeArchived?: boolean; weekStartsOn?: number } = {},
): Promise<HabitSummary[]> {
  const weekStartsOn = options.weekStartsOn ?? 1;
  const habits = await db.habit.findMany({
    where: { userId, ...(options.includeArchived ? {} : { isArchived: false }) },
    include: { lifeArea: { select: { id: true, name: true, color: true } } },
    orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }],
  });
  if (habits.length === 0) return [];

  const checkIns = await db.habitCheckIn.findMany({
    where: {
      userId,
      habitId: { in: habits.map((habit) => habit.id) },
      date: { gte: new Date(Date.parse(`${addDays(today, -400)}T00:00:00Z`)) },
    },
    select: { habitId: true, date: true, value: true },
  });

  const byHabit = new Map<string, { date: DateOnly; value: number }[]>();
  for (const checkIn of checkIns) {
    const list = byHabit.get(checkIn.habitId) ?? [];
    list.push({ date: dbDateToDateOnly(checkIn.date), value: checkIn.value });
    byHabit.set(checkIn.habitId, list);
  }

  const recentDays: DateOnly[] = [];
  for (let i = 13; i >= 0; i -= 1) recentDays.push(addDays(today, -i));

  return habits.map((habit) => {
    const definition = toDefinition(habit);
    const entries = byHabit.get(habit.id) ?? [];
    const streaks = computeStreaks(definition, entries, today, weekStartsOn);
    const valueToday =
      entries.filter((entry) => entry.date === today).reduce((sum, e) => sum + e.value, 0) || 0;
    const recent = recentDays.map((date) => ({
      date,
      value: entries.filter((entry) => entry.date === date).reduce((sum, e) => sum + e.value, 0),
      done: isCompletedOn(definition, entries, date),
    }));

    return {
      id: habit.id,
      name: habit.name,
      description: habit.description,
      frequency: habit.frequency as HabitFrequency,
      targetPerPeriod: habit.targetPerPeriod,
      weekdays: habit.weekdays,
      unit: habit.unit,
      color: habit.color,
      icon: habit.icon,
      isArchived: habit.isArchived,
      lifeArea: habit.lifeArea,
      currentStreak: streaks.current,
      bestStreak: streaks.best,
      streakUnit: streaks.unit,
      completion30: completionRate(
        definition,
        entries,
        addDays(today, -29),
        today,
        today,
        weekStartsOn,
      ),
      todayValue: valueToday,
      doneToday: isCompletedOn(definition, entries, today),
      recent,
    };
  });
}

export interface HabitDetail extends HabitSummary {
  weekStartsOn: number;
}

export async function getHabitDetail(
  userId: string,
  habitId: string,
  today: DateOnly,
  weekStartsOn = 1,
): Promise<HabitSummary | null> {
  const all = await listHabits(userId, today, { includeArchived: true, weekStartsOn });
  return all.find((habit) => habit.id === habitId) ?? null;
}
