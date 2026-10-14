import "server-only";

import { db } from "@/lib/db";
import { DEFAULT_LIFE_AREAS } from "@/lib/life-areas/defaults";

/**
 * Idempotently creates the scaffolding every account needs:
 * preferences, schedule settings and the starter life areas.
 *
 * Safe to call more than once (e.g. after sign-up and again on first load).
 */
export async function provisionUser(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.userPreferences.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await tx.scheduleSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existingAreas = await tx.lifeArea.count({ where: { userId } });
    if (existingAreas === 0) {
      await tx.lifeArea.createMany({
        data: DEFAULT_LIFE_AREAS.map((area, index) => ({
          userId,
          name: area.name,
          color: area.color,
          icon: area.icon,
          order: index,
        })),
        skipDuplicates: true,
      });
    }
  });
}
