import { Router } from "express";
import type { Db } from "@gitmesh/data";
import { dashboardService } from "../core/dashboard.js";
import { assertProjectAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  router.get("/projects/:projectId/dashboard", async (req, res) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    const summary = await svc.summary(projectId);
    res.json(summary);
  });

  return router;
}
