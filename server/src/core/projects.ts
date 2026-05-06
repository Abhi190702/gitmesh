import { eq, count, inArray } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { normalizeProjectUrlKey } from "@gitmesh/core";
import {
  projects,
  agents,
  agentApiKeys,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  issues,
  issueComments,
  subprojects,
  goals,
  heartbeatRuns,
  heartbeatRunEvents,
  costEvents,
  approvalComments,
  approvals,
  activityLog,
  projectSecrets,
  joinRequests,
  invites,
  principalPermissionGrants,
  projectMemberships,
} from "@gitmesh/data";

type ProjectShortnameRow = { id: string; name: string };

/**
 * Given a candidate project display name, resolve a unique name by appending a
 * numeric suffix when the normalised shortname collides with existing projects.
 */
export function resolveProjectNameForUniqueShortname(
  candidateName: string,
  existingProjects: ProjectShortnameRow[],
  options?: { excludeProjectId?: string },
): string {
  const candidateShortname = normalizeProjectUrlKey(candidateName);
  if (!candidateShortname) return candidateName;

  const collides = (shortname: string) =>
    existingProjects.some((p) => {
      if (options?.excludeProjectId && p.id === options.excludeProjectId) return false;
      return normalizeProjectUrlKey(p.name) === shortname;
    });

  if (!collides(candidateShortname)) return candidateName;

  for (let i = 2; i <= 100; i++) {
    const suffixedShortname = normalizeProjectUrlKey(`${candidateName} ${i}`);
    if (suffixedShortname && !collides(suffixedShortname)) {
      return `${candidateName} ${i}`;
    }
  }
  return `${candidateName} ${Date.now()}`;
}

export function projectService(db: Db) {
  const ISSUE_PREFIX_FALLBACK = "CMP";

  function deriveIssuePrefixBase(name: string) {
    const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
    return normalized.slice(0, 3) || ISSUE_PREFIX_FALLBACK;
  }

  function suffixForAttempt(attempt: number) {
    if (attempt <= 1) return "";
    return "A".repeat(attempt - 1);
  }

  function isIssuePrefixConflict(error: unknown) {
    const constraint = typeof error === "object" && error !== null && "constraint" in error
      ? (error as { constraint?: string }).constraint
      : typeof error === "object" && error !== null && "constraint_name" in error
        ? (error as { constraint_name?: string }).constraint_name
        : undefined;
    return typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "23505"
      && constraint === "projects_issue_prefix_idx";
  }

  async function createProjectWithUniquePrefix(data: typeof projects.$inferInsert) {
    const base = deriveIssuePrefixBase(data.name);
    let suffix = 1;
    while (suffix < 10000) {
      const candidate = `${base}${suffixForAttempt(suffix)}`;
      try {
        const rows = await db
          .insert(projects)
          .values({ ...data, issuePrefix: candidate })
          .returning();
        return rows[0];
      } catch (error) {
        if (!isIssuePrefixConflict(error)) throw error;
      }
      suffix += 1;
    }
    throw new Error("Unable to allocate unique issue prefix");
  }

  return {
    list: () => db.select().from(projects),

    getById: (id: string) =>
      db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .then((rows) => rows[0] ?? null),

    listByIds: (scopeProjectId: string, ids: string[]) =>
      ids.length === 0
        ? Promise.resolve([])
        : db
            .select()
            .from(projects)
            .where(inArray(projects.id, ids)),

    create: async (data: typeof projects.$inferInsert) => createProjectWithUniquePrefix(data),

    update: (id: string, data: Partial<typeof projects.$inferInsert>) =>
      db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    archive: (id: string) =>
      db
        .update(projects)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    remove: (id: string) =>
      db.transaction(async (tx) => {
        // Delete from child tables in dependency order
        await tx.delete(heartbeatRunEvents).where(eq(heartbeatRunEvents.projectId, id));
        await tx.delete(agentTaskSessions).where(eq(agentTaskSessions.projectId, id));
        await tx.delete(heartbeatRuns).where(eq(heartbeatRuns.projectId, id));
        await tx.delete(agentWakeupRequests).where(eq(agentWakeupRequests.projectId, id));
        await tx.delete(agentApiKeys).where(eq(agentApiKeys.projectId, id));
        await tx.delete(agentRuntimeState).where(eq(agentRuntimeState.projectId, id));
        await tx.delete(issueComments).where(eq(issueComments.projectId, id));
        await tx.delete(costEvents).where(eq(costEvents.projectId, id));
        await tx.delete(approvalComments).where(eq(approvalComments.projectId, id));
        await tx.delete(approvals).where(eq(approvals.projectId, id));
        await tx.delete(projectSecrets).where(eq(projectSecrets.projectId, id));
        await tx.delete(joinRequests).where(eq(joinRequests.projectId, id));
        await tx.delete(invites).where(eq(invites.projectId, id));
        await tx.delete(principalPermissionGrants).where(eq(principalPermissionGrants.projectId, id));
        await tx.delete(projectMemberships).where(eq(projectMemberships.projectId, id));
        await tx.delete(issues).where(eq(issues.projectId, id));
        await tx.delete(goals).where(eq(goals.projectId, id));
        await tx.delete(subprojects).where(eq(subprojects.projectId, id));
        await tx.delete(agents).where(eq(agents.projectId, id));
        await tx.delete(activityLog).where(eq(activityLog.projectId, id));
        const rows = await tx
          .delete(projects)
          .where(eq(projects.id, id))
          .returning();
        return rows[0] ?? null;
      }),

    stats: () =>
      Promise.all([
        db
          .select({ projectId: agents.projectId, count: count() })
          .from(agents)
          .groupBy(agents.projectId),
        db
          .select({ projectId: issues.projectId, count: count() })
          .from(issues)
          .groupBy(issues.projectId),
      ]).then(([agentRows, issueRows]) => {
        const result: Record<string, { agentCount: number; issueCount: number }> = {};
        for (const row of agentRows) {
          result[row.projectId] = { agentCount: row.count, issueCount: 0 };
        }
        for (const row of issueRows) {
          if (result[row.projectId]) {
            result[row.projectId].issueCount = row.count;
          } else {
            result[row.projectId] = { agentCount: 0, issueCount: row.count };
          }
        }
        return result;
      }),
  };
}
