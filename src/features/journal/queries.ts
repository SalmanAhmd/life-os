import "server-only";

import type { Prisma } from "@prisma/client";

import { type DateOnly, dateOnlyToDb, dbDateToDateOnly } from "@/lib/dates";
import { db } from "@/lib/db";

const journalSelect = {
  id: true,
  date: true,
  title: true,
  body: true,
  mood: true,
  gratitude: true,
  isPrivate: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
} satisfies Prisma.JournalEntrySelect;

type JournalRow = Prisma.JournalEntryGetPayload<{ select: typeof journalSelect }>;

export interface JournalEntrySummary {
  id: string;
  date: DateOnly;
  title: string | null;
  body: string;
  mood: string | null;
  gratitude: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; name: string; color: string }[];
}

function toSummary(row: JournalRow): JournalEntrySummary {
  return {
    id: row.id,
    date: dbDateToDateOnly(row.date),
    title: row.title,
    body: row.body,
    mood: row.mood,
    gratitude: row.gratitude,
    isPrivate: row.isPrivate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tags: row.tags,
  };
}

export async function listJournalEntries(
  userId: string,
  options: { from?: DateOnly; to?: DateOnly; limit?: number } = {},
): Promise<JournalEntrySummary[]> {
  const rows = await db.journalEntry.findMany({
    where: {
      userId,
      ...(options.from || options.to
        ? {
            date: {
              ...(options.from ? { gte: dateOnlyToDb(options.from) } : {}),
              ...(options.to ? { lte: dateOnlyToDb(options.to) } : {}),
            },
          }
        : {}),
    },
    select: journalSelect,
    orderBy: { date: "desc" },
    take: options.limit ?? 200,
  });
  return rows.map(toSummary);
}

export async function getJournalEntryForDate(
  userId: string,
  date: DateOnly,
): Promise<JournalEntrySummary | null> {
  const row = await db.journalEntry.findFirst({
    where: { userId, date: dateOnlyToDb(date) },
    select: journalSelect,
  });
  return row ? toSummary(row) : null;
}

export async function getJournalEntry(
  userId: string,
  id: string,
): Promise<JournalEntrySummary | null> {
  const row = await db.journalEntry.findFirst({ where: { id, userId }, select: journalSelect });
  return row ? toSummary(row) : null;
}
