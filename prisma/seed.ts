import { db } from "@/lib/db";
import { DEFAULT_LIFE_AREAS } from "@/lib/life-areas/defaults";

seed.after("user", async (user) => {
  const existingAreas = await db.lifeArea.count({ where: { userId: user.id } });
  if (existingAreas === 0) {
    await db.lifeArea.createMany({
      data: DEFAULT_LIFE_AREAS.map((area, index) => ({
        userId: user.id,
        name: area.name,
        color: area.color,
        icon: area.icon,
        order: index,
      })),
    });
  }
});
