import { Router } from "express";
import { and, desc, eq, gte } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import { heartbeatRuns, heartbeatRunEvents } from "@gitmesh/data";
import { heartbeatService } from "../core/index.js";
import { notFound } from "../errors.js";
import { assertProjectAccess } from "./authz.js";

export function heartbeatRoutes(db: Db) {
  const router = Router();
  const svc = heartbeatService(db);

  // GET /projects/:projectId/heartbeats/runs
  // List heartbeat runs with optional filters
  router.get("/projects/:projectId/heartbeats/runs", async (req, res) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const status = req.query.status as string | undefined;
      const agentId = req.query.agentId as string | undefined;

      const filters = [eq(heartbeatRuns.projectId, projectId)];
      if (status) {
        filters.push(eq(heartbeatRuns.status, status));
      }
      if (agentId) {
        filters.push(eq(heartbeatRuns.agentId, agentId));
      }

      const runs = await db
        .select()
        .from(heartbeatRuns)
        .where(and(...filters))
        .orderBy(desc(heartbeatRuns.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count for pagination
      const countResult = await db
        .select({ count: heartbeatRuns.id })
        .from(heartbeatRuns)
        .where(and(...filters));

      res.json({
        data: runs,
        pagination: {
          limit,
          offset,
          total: countResult.length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch heartbeat runs" });
    }
  });

  // GET /projects/:projectId/heartbeats/runs/:runId
  // Get a single heartbeat run with details
  router.get("/projects/:projectId/heartbeats/runs/:runId", async (req, res) => {
    const projectId = req.params.projectId as string;
    const runId = req.params.runId as string;
    assertProjectAccess(req, projectId);

    try {
      const run = await db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.id, runId), eq(heartbeatRuns.projectId, projectId)))
        .limit(1);

      if (!run.length) {
        res.status(404).json({ error: "Heartbeat run not found" });
        return;
      }

      res.json(run[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch heartbeat run" });
    }
  });

  // GET /projects/:projectId/heartbeats/runs/:runId/events
  // Get heartbeat run events/logs with optional filtering
  router.get("/projects/:projectId/heartbeats/runs/:runId/events", async (req, res) => {
    const projectId = req.params.projectId as string;
    const runId = req.params.runId as string;
    assertProjectAccess(req, projectId);

    try {
      // First verify the run exists in this project
      const run = await db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.id, runId), eq(heartbeatRuns.projectId, projectId)))
        .limit(1);

      if (!run.length) {
        res.status(404).json({ error: "Heartbeat run not found" });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const events = await db
        .select()
        .from(heartbeatRunEvents)
        .where(eq(heartbeatRunEvents.runId, runId))
        .orderBy(heartbeatRunEvents.seq)
        .limit(limit)
        .offset(offset);

      res.json({
        data: events,
        pagination: {
          limit,
          offset,
          total: events.length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch heartbeat events" });
    }
  });

  // POST /projects/:projectId/heartbeats/trigger
  // Manually trigger a heartbeat for an agent (operator-gated)
  router.post("/projects/:projectId/heartbeats/trigger", async (req, res) => {
    const projectId = req.params.projectId as string;
    const { agentId } = req.body as { agentId?: string };
    assertProjectAccess(req, projectId);

    if (!agentId) {
      res.status(400).json({ error: "Missing agentId in request body" });
      return;
    }

    try {
      const run = await svc.invoke(
        agentId,
        "on_demand",
        { projectId },
        "manual",
        {
          actorType: req.actor.type === "operator" ? "user" : "agent",
          actorId: req.actor.type === "operator" ? req.actor.userId : req.actor.agentId,
        },
      );

      if (!run) {
        res.status(409).json({ error: "Heartbeat request was skipped or coalesced" });
        return;
      }

      res.json({
        status: "triggered",
        runId: run.id,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: "Agent not found" });
      } else {
        res.status(500).json({ error: "Failed to trigger heartbeat" });
      }
    }
  });

  return router;
}
