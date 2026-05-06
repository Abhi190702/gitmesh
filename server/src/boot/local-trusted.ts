/**
 * Local-trusted-mode helpers.
 *
 * In `local_trusted` deployment mode the server runs without a real auth
 * provider, but every domain entity still needs a principal owner. We seed
 * a single "local-board" user, mark it as instance_admin, and ensure it has
 * an active membership in every project. The helper is idempotent so the
 * bootstrap can call it on every start.
 */
import { and, eq } from "@gitmesh/data";
import {
  authUsers,
  instanceUserRoles,
  projectMemberships,
  projects,
} from "@gitmesh/data";

export const LOCAL_BOARD_USER_ID = "local-board";
export const LOCAL_BOARD_USER_EMAIL = "local@gitmesh.local";
export const LOCAL_BOARD_USER_NAME = "Board";

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export async function ensureLocalTrustedBoardPrincipal(db: any): Promise<void> {
  const now = new Date();

  // 1. Seed the well-known board user record.
  const existingUser = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.id, LOCAL_BOARD_USER_ID))
    .then((rows: Array<{ id: string }>) => rows[0] ?? null);

  if (!existingUser) {
    await db.insert(authUsers).values({
      id: LOCAL_BOARD_USER_ID,
      name: LOCAL_BOARD_USER_NAME,
      email: LOCAL_BOARD_USER_EMAIL,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 2. Ensure the user holds the instance_admin role.
  const role = await db
    .select({ id: instanceUserRoles.id })
    .from(instanceUserRoles)
    .where(
      and(
        eq(instanceUserRoles.userId, LOCAL_BOARD_USER_ID),
        eq(instanceUserRoles.role, "instance_admin"),
      ),
    )
    .then((rows: Array<{ id: string }>) => rows[0] ?? null);
  if (!role) {
    await db.insert(instanceUserRoles).values({
      userId: LOCAL_BOARD_USER_ID,
      role: "instance_admin",
    });
  }

  // 3. Ensure the user is an owner of every existing project.
  const projectRows = await db.select({ id: projects.id }).from(projects);
  for (const project of projectRows) {
    const membership = await db
      .select({ id: projectMemberships.id })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.projectId, project.id),
          eq(projectMemberships.principalType, "user"),
          eq(projectMemberships.principalId, LOCAL_BOARD_USER_ID),
        ),
      )
      .then((rows: Array<{ id: string }>) => rows[0] ?? null);
    if (membership) continue;
    await db.insert(projectMemberships).values({
      projectId: project.id,
      principalType: "user",
      principalId: LOCAL_BOARD_USER_ID,
      status: "active",
      membershipRole: "owner",
    });
  }
}
