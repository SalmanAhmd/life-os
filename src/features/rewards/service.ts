import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  type PointRules,
  type RewardAward,
  type RewardReason,
  reversalKey,
} from "@/lib/rewards/rules";

/** Minimal transaction-capable client type (PrismaClient or tx). */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface RewardReferences {
  taskId?: string;
  occurrenceId?: string;
  habitId?: string;
  goalMilestoneId?: string;
  note?: string;
}

/**
 * Awards points at most once for a given idempotency key.
 *
 * Relies on the `RewardTransaction.idempotencyKey` unique constraint and
 * `createMany({ skipDuplicates: true })`, so concurrent or retried calls are
 * safe. Returns true when a new row was written.
 */
export async function awardOnce(
  client: DbClient,
  userId: string,
  award: RewardAward,
  references: RewardReferences = {},
): Promise<boolean> {
  const result = await client.rewardTransaction.createMany({
    data: [
      {
        userId,
        points: award.points,
        reason: award.reason,
        idempotencyKey: award.idempotencyKey,
        taskId: references.taskId ?? null,
        occurrenceId: references.occurrenceId ?? null,
        habitId: references.habitId ?? null,
        goalMilestoneId: references.goalMilestoneId ?? null,
        note: references.note ?? null,
      },
    ],
    skipDuplicates: true,
  });
  return result.count > 0;
}

/**
 * Reverses a previously awarded transaction by writing a compensating, negative
 * entry. Idempotent: reversing the same key twice is a no-op. The original
 * ledger row is never mutated, preserving the audit trail.
 */
export async function reverseAward(
  client: DbClient,
  userId: string,
  originalKey: string,
  references: RewardReferences = {},
): Promise<boolean> {
  const key = reversalKey(originalKey);

  const alreadyReversed = await client.rewardTransaction.findUnique({
    where: { idempotencyKey: key },
    select: { id: true },
  });
  if (alreadyReversed) return false;

  const original = await client.rewardTransaction.findUnique({
    where: { idempotencyKey: originalKey },
    select: { points: true, reason: true },
  });
  if (!original) return false;

  await client.rewardTransaction.create({
    data: {
      userId,
      points: -original.points,
      reason: "REVERSAL" as RewardReason,
      idempotencyKey: key,
      taskId: references.taskId ?? null,
      occurrenceId: references.occurrenceId ?? null,
      habitId: references.habitId ?? null,
      goalMilestoneId: references.goalMilestoneId ?? null,
      note: references.note ?? `Reversal of ${original.reason}`,
    },
  });
  return true;
}

export function pointRulesFromPreferences(preferences: {
  pointsPerTask: number;
  pointsPerHighPriority: boolean;
  highPriorityBonus: number;
  pointsPerHabit: number;
  pointsPerMilestone: number;
  perfectDayBonus: number;
  perfectDayEnabled: boolean;
}): PointRules {
  return {
    pointsPerTask: preferences.pointsPerTask,
    pointsPerHighPriority: preferences.pointsPerHighPriority,
    highPriorityBonus: preferences.highPriorityBonus,
    pointsPerHabit: preferences.pointsPerHabit,
    pointsPerMilestone: preferences.pointsPerMilestone,
    perfectDayBonus: preferences.perfectDayBonus,
    perfectDayEnabled: preferences.perfectDayEnabled,
  };
}
