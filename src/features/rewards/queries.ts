import "server-only";

import type { RewardReason } from "@prisma/client";

import { type DateOnly, dateOnlyToDb } from "@/lib/dates";
import { db } from "@/lib/db";

export interface RewardTransactionSummary {
  id: string;
  points: number;
  reason: RewardReason;
  note: string | null;
  createdAt: Date;
}

export async function getPointsBalance(userId: string): Promise<number> {
  const aggregate = await db.rewardTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return aggregate._sum.points ?? 0;
}

export async function listRewardTransactions(
  userId: string,
  options: { limit?: number } = {},
): Promise<RewardTransactionSummary[]> {
  return db.rewardTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 25,
    select: { id: true, points: true, reason: true, note: true, createdAt: true },
  });
}

/** Points earned per day across a range (for the points chart). */
export async function pointsByDay(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): Promise<{ date: DateOnly; points: number }[]> {
  const rows = await db.rewardTransaction.findMany({
    where: {
      userId,
      createdAt: {
        gte: dateOnlyToDb(from),
        lt: new Date(dateOnlyToDb(to).getTime() + 86_400_000),
      },
    },
    select: { points: true, createdAt: true },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    totals.set(key, (totals.get(key) ?? 0) + row.points);
  }
  return Array.from(totals.entries())
    .map(([date, points]) => ({ date, points }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function pointsEarnedInRange(
  userId: string,
  from: DateOnly,
  to: DateOnly,
): Promise<number> {
  const aggregate = await db.rewardTransaction.aggregate({
    where: {
      userId,
      createdAt: {
        gte: dateOnlyToDb(from),
        lt: new Date(dateOnlyToDb(to).getTime() + 86_400_000),
      },
    },
    _sum: { points: true },
  });
  return aggregate._sum.points ?? 0;
}
