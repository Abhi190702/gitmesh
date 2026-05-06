import { and, desc, eq, gte, isNotNull, lte, sql } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { activityLog, agents, projects, costEvents, heartbeatRuns, issues, subprojects } from "@gitmesh/data";
import { notFound, unprocessable } from "../errors.js";

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

export function costService(db: Db) {
  return {
    createEvent: async (projectId: string, data: Omit<typeof costEvents.$inferInsert, "projectId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.projectId !== projectId) {
        throw unprocessable("Agent does not belong to project");
      }

      const event = await db
        .insert(costEvents)
        .values({ ...data, projectId })
        .returning()
        .then((rows) => rows[0]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: sql`${agents.spentMonthlyCents} + ${event.costCents}`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(projects)
        .set({
          spentMonthlyCents: sql`${projects.spentMonthlyCents} + ${event.costCents}`,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      const updatedAgent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, event.agentId))
        .then((rows) => rows[0] ?? null);

      if (
        updatedAgent &&
        updatedAgent.budgetMonthlyCents > 0 &&
        updatedAgent.spentMonthlyCents >= updatedAgent.budgetMonthlyCents &&
        updatedAgent.status !== "paused" &&
        updatedAgent.status !== "terminated"
      ) {
        await db
          .update(agents)
          .set({ status: "paused", updatedAt: new Date() })
          .where(eq(agents.id, updatedAgent.id));
      }

      return event;
    },

    summary: async (projectId: string, range?: CostDateRange) => {
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .then((rows) => rows[0] ?? null);

      if (!project) throw notFound("Project not found");

      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.projectId, projectId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const [{ total }] = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions));

      const spendCents = Number(total);
      const utilization =
        project.budgetMonthlyCents > 0
          ? (spendCents / project.budgetMonthlyCents) * 100
          : 0;

      return {
        projectId,
        spendCents,
        budgetCents: project.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (projectId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.projectId, projectId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const costRows = await db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));

      const runConditions: ReturnType<typeof eq>[] = [eq(heartbeatRuns.projectId, projectId)];
      if (range?.from) runConditions.push(gte(heartbeatRuns.finishedAt, range.from));
      if (range?.to) runConditions.push(lte(heartbeatRuns.finishedAt, range.to));

      const runRows = await db
        .select({
          agentId: heartbeatRuns.agentId,
          apiRunCount:
            sql<number>`coalesce(sum(case when coalesce((${heartbeatRuns.usageJson} ->> 'billingType'), 'unknown') = 'api' then 1 else 0 end), 0)::int`,
          subscriptionRunCount:
            sql<number>`coalesce(sum(case when coalesce((${heartbeatRuns.usageJson} ->> 'billingType'), 'unknown') = 'subscription' then 1 else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when coalesce((${heartbeatRuns.usageJson} ->> 'billingType'), 'unknown') = 'subscription' then coalesce((${heartbeatRuns.usageJson} ->> 'inputTokens')::int, 0) else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when coalesce((${heartbeatRuns.usageJson} ->> 'billingType'), 'unknown') = 'subscription' then coalesce((${heartbeatRuns.usageJson} ->> 'outputTokens')::int, 0) else 0 end), 0)::int`,
        })
        .from(heartbeatRuns)
        .where(and(...runConditions))
        .groupBy(heartbeatRuns.agentId);

      const runRowsByAgent = new Map(runRows.map((row) => [row.agentId, row]));
      return costRows.map((row) => {
        const runRow = runRowsByAgent.get(row.agentId);
        return {
          ...row,
          apiRunCount: runRow?.apiRunCount ?? 0,
          subscriptionRunCount: runRow?.subscriptionRunCount ?? 0,
          subscriptionInputTokens: runRow?.subscriptionInputTokens ?? 0,
          subscriptionOutputTokens: runRow?.subscriptionOutputTokens ?? 0,
        };
      });
    },

    byProject: async (projectId: string, range?: CostDateRange) => {
      const issueIdAsText = sql<string>`${issues.id}::text`;
      const runProjectLinks = db
        .selectDistinctOn([activityLog.runId, issues.projectId], {
          runId: activityLog.runId,
          projectId: issues.projectId,
        })
        .from(activityLog)
        .innerJoin(
          issues,
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            eq(activityLog.projectId, projectId),
            eq(issues.projectId, projectId),
            isNotNull(activityLog.runId),
            isNotNull(issues.projectId),
          ),
        )
        .orderBy(activityLog.runId, issues.projectId, desc(activityLog.createdAt))
        .as("run_project_links");

      const conditions: ReturnType<typeof eq>[] = [eq(heartbeatRuns.projectId, projectId)];
      if (range?.from) conditions.push(gte(heartbeatRuns.finishedAt, range.from));
      if (range?.to) conditions.push(lte(heartbeatRuns.finishedAt, range.to));

      const costCentsExpr = sql<number>`coalesce(sum(round(coalesce((${heartbeatRuns.usageJson} ->> 'costUsd')::numeric, 0) * 100)), 0)::int`;

      return db
        .select({
          projectId: runProjectLinks.projectId,
          projectName: subprojects.name,
          costCents: costCentsExpr,
          inputTokens: sql<number>`coalesce(sum(coalesce((${heartbeatRuns.usageJson} ->> 'inputTokens')::int, 0)), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(coalesce((${heartbeatRuns.usageJson} ->> 'outputTokens')::int, 0)), 0)::int`,
        })
        .from(runProjectLinks)
        .innerJoin(heartbeatRuns, eq(runProjectLinks.runId, heartbeatRuns.id))
        .innerJoin(subprojects, eq(runProjectLinks.projectId, subprojects.id))
        .where(and(...conditions))
        .groupBy(runProjectLinks.projectId, subprojects.name)
        .orderBy(desc(costCentsExpr));
    },
  };
}
