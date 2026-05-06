import { eq } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { assets } from "@gitmesh/data";

export function assetService(db: Db) {
  return {
    create: (projectId: string, data: Omit<typeof assets.$inferInsert, "projectId">) =>
      db
        .insert(assets)
        .values({ ...data, projectId })
        .returning()
        .then((rows) => rows[0]),

    getById: (id: string) =>
      db
        .select()
        .from(assets)
        .where(eq(assets.id, id))
        .then((rows) => rows[0] ?? null),
  };
}

