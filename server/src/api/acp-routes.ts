import { Router, type Request, type Response } from "express";
import type { Db } from "@gitmesh/data";
import { acpServer, type JsonRpcRequest } from "../core/acp-server.js";
import { assertProjectAccess } from "./authz.js";

export function acpRoutes(db: Db) {
  const router = Router();
  const acp = acpServer(db);

  router.post("/projects/:projectId/acp", async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const body = req.body;
    if (Array.isArray(body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Batch requests are not supported",
        },
      });
      return;
    }

    const response = await acp.execute(projectId, req.actor, body as JsonRpcRequest);

    if (response === null) {
      res.status(204).send();
      return;
    }

    const errorCode = "error" in response ? response.error.code : null;
    if (errorCode === -32001) {
      res.status(401).json(response);
      return;
    }
    if (errorCode === -32002 || errorCode === -32003) {
      res.status(409).json(response);
      return;
    }
    if (errorCode && errorCode <= -32600 && errorCode >= -32700) {
      res.status(400).json(response);
      return;
    }

    res.json(response);
  });

  router.get("/projects/:projectId/acp/health", (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    res.json({
      status: "healthy",
      protocol: "json-rpc-2.0",
      projectId,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
