import { eq } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { goals } from "@gitmesh/data";

export function goalService(db: Db) {
  return {
    list: (projectId: string) => db.select().from(goals).where(eq(goals.projectId, projectId)),

    getById: (id: string) =>
      db
        .select()
        .from(goals)
        .where(eq(goals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (projectId: string, data: Omit<typeof goals.$inferInsert, "projectId">) =>
      db
        .insert(goals)
        .values({ ...data, projectId })
        .returning()
        .then((rows) => rows[0]),

    update: (id: string, data: Partial<typeof goals.$inferInsert>) =>
      db
        .update(goals)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db
        .delete(goals)
        .where(eq(goals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
