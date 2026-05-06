import { Router } from "express";
import type { Db } from "@gitmesh/data";
import { createGoalSchema, updateGoalSchema } from "@gitmesh/core";
import { validate } from "../infra/middleware/validate.js";
import { goalService, logActivity } from "../core/index.js";
import { assertProjectAccess, getActorInfo } from "./authz.js";

export function goalRoutes(db: Db) {
  const router = Router();
  const svc = goalService(db);

  const collectionPaths = ["/projects/:projectId/goals", "/projects/:projectId/milestones"];
  const itemPaths = ["/goals/:id", "/milestones/:id"];

  router.get(collectionPaths, async (req, res) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    const result = await svc.list(projectId);
    res.json(result);
  });

  router.get(itemPaths, async (req, res) => {
    const id = req.params.id as string;
    const goal = await svc.getById(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertProjectAccess(req, goal.projectId);
    res.json(goal);
  });

  router.post(collectionPaths, validate(createGoalSchema), async (req, res) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    const goal = await svc.create(projectId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.created",
      entityType: "goal",
      entityId: goal.id,
      details: { title: goal.title },
    });
    res.status(201).json(goal);
  });

  router.patch(itemPaths, validate(updateGoalSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertProjectAccess(req, existing.projectId);
    const goal = await svc.update(id, req.body);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      projectId: goal.projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.updated",
      entityType: "goal",
      entityId: goal.id,
      details: req.body,
    });

    res.json(goal);
  });

  router.delete(itemPaths, async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertProjectAccess(req, existing.projectId);
    const goal = await svc.remove(id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      projectId: goal.projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "goal.deleted",
      entityType: "goal",
      entityId: goal.id,
    });

    res.json(goal);
  });

  return router;
}
