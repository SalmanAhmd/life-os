import type { RecurrenceRule } from "@prisma/client";

import { dbDateToDateOnly } from "@/lib/dates";
import type { RecurrenceDefinition } from "@/lib/recurrence";

/** Maps a persisted RecurrenceRule row into the pure domain definition. */
export function ruleToDefinition(rule: RecurrenceRule): RecurrenceDefinition {
  return {
    frequency: rule.frequency,
    interval: rule.interval,
    byWeekday: rule.byWeekday,
    byMonthDay: rule.byMonthDay,
    bySetPos: rule.bySetPos,
    byWeekdayForSetPos: rule.byWeekdayForSetPos,
    byMonth: rule.byMonth,
    startDate: dbDateToDateOnly(rule.startDate),
    endDate: rule.endDate ? dbDateToDateOnly(rule.endDate) : null,
    count: rule.count,
    exclusions: Array.isArray(rule.exclusions) ? (rule.exclusions as string[]) : [],
  };
}
