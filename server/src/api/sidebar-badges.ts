import { Router } from "express";
import type { Db } from "@gitmesh/data";
import { and, eq, sql } from "@gitmesh/data";
import { joinRequests } from "@gitmesh/data";
import { sidebarBadgeService } from "../core/sidebar-badges.js";
import { issueService } from "../core/issues.js";
import { accessService } from "../core/access.js";
import { dashboardService } from "../core/dashboard.js";
import { assertProjectAccess } from "./authz.js";

export function sidebarBadgeRoutes(db: Db) {
  const router = Router();
  const svc = sidebarBadgeService(db);
  const issueSvc = issueService(db);
  const access = accessService(db);
  const dashboard = dashboardService(db);

  router.get("/projects/:projectId/sidebar-badges", async (req, res) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    let canApproveJoins = false;
    if (req.actor.type === "operator") {
      canApproveJoins =
        req.actor.source === "local_implicit" ||
        Boolean(req.actor.isInstanceAdmin) ||
        (await access.canUser(projectId, req.actor.userId, "joins:approve"));
    } else if (req.actor.type === "agent" && req.actor.agentId) {
      canApproveJoins = await access.hasPermission(projectId, "agent", req.actor.agentId, "joins:approve");
    }

    const joinRequestCount = canApproveJoins
      ? await db
        .select({ count: sql<number>`count(*)` })
        .from(joinRequests)
        .where(and(eq(joinRequests.projectId, projectId), eq(joinRequests.status, "pending_approval")))
        .then((rows) => Number(rows[0]?.count ?? 0))
      : 0;

    const badges = await svc.get(projectId, {
      joinRequests: joinRequestCount,
    });
    const summary = await dashboard.summary(projectId);
    const staleIssueCount = await issueSvc.staleCount(projectId, 24 * 60);
    const hasFailedRuns = badges.failedRuns > 0;
    const alertsCount =
      (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
      (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 ? 1 : 0);
    badges.inbox = badges.failedRuns + alertsCount + staleIssueCount + joinRequestCount + badges.approvals;

    res.json(badges);
  });

  return router;
}
