/**
 * MCP Server API Routes
 * 
 * Exposes MCP protocol endpoints for IDE integration
 * Supports both stdio and SSE transports
 */

import { Router, Request, Response } from "express";
import { Db } from "@gitmesh/data";
import { mcpServer } from "../core/mcp-server.js";

export function mcpRoutes(db: Db) {
  const router = Router();
  const mcp = mcpServer(db);

  /**
   * MCP Root Endpoint
   * Returns server capabilities and initialization info
   */
  router.get("/mcp", async (req: Request, res: Response) => {
    try {
      const projectId = req.query.projectId as string;
      const agentId = req.query.agentId as string;

      if (!projectId || !agentId) {
        return res.status(400).json({
          error: "Missing projectId or agentId",
        });
      }

      const tools = await mcp.getAvailableTools(projectId, agentId);
      const resources = await mcp.getAvailableResources(projectId, agentId);

      res.json({
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {
            listTools: true,
          },
          resources: {
            listResources: true,
            readResource: true,
          },
          prompts: false,
          sampling: false,
        },
        serverInfo: {
          name: "gitmesh-mcp",
          version: "1.0.0",
        },
        tools,
        resources,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * List Available Tools
   * MCP protocol: tools/list
   */
  router.post("/mcp/tools/list", async (req: Request, res: Response) => {
    try {
      const { projectId, agentId } = req.body;

      if (!projectId || !agentId) {
        return res.status(400).json({
          error: "Missing projectId or agentId in request body",
        });
      }

      const tools = await mcp.getAvailableTools(projectId, agentId);

      res.json({
        tools,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Call MCP Tool
   * MCP protocol: tools/call
   */
  router.post("/mcp/tools/call", async (req: Request, res: Response) => {
    try {
      const { toolName, input, projectId, agentId } = req.body;

      if (!toolName || !projectId || !agentId) {
        return res.status(400).json({
          error: "Missing toolName, projectId, or agentId",
        });
      }

      const result = await mcp.executeTool(
        toolName,
        input || {},
        projectId,
        agentId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * List Available Resources
   * MCP protocol: resources/list
   */
  router.post("/mcp/resources/list", async (req: Request, res: Response) => {
    try {
      const { projectId, agentId } = req.body;

      if (!projectId || !agentId) {
        return res.status(400).json({
          error: "Missing projectId or agentId",
        });
      }

      const resources = await mcp.getAvailableResources(projectId, agentId);

      res.json({
        resources,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Read MCP Resource
   * MCP protocol: resources/read
   */
  router.post("/mcp/resources/read", async (req: Request, res: Response) => {
    try {
      const { uri, projectId, agentId } = req.body;

      if (!uri || !projectId || !agentId) {
        return res.status(400).json({
          error: "Missing uri, projectId, or agentId",
        });
      }

      const resource = await mcp.getResource(uri, projectId, agentId);

      if (!resource) {
        return res.status(404).json({
          error: `Resource not found: ${uri}`,
        });
      }

      res.json(resource);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * MCP over SSE (Server-Sent Events) for streaming
   * Allows bidirectional streaming for long-lived connections
   */
  router.get("/mcp/sse", (req: Request, res: Response) => {
    const projectId = req.query.projectId as string;
    const agentId = req.query.agentId as string;

    if (!projectId || !agentId) {
      return res.status(400).json({
        error: "Missing projectId or agentId",
      });
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send initialization message
    res.write(
      `data: ${JSON.stringify({
        type: "initialized",
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "gitmesh-mcp",
          version: "1.0.0",
        },
      })}\n\n`
    );

    // Handle incoming MCP requests via SSE
    // In a production scenario, you'd receive JSON-RPC 2.0 requests here
    // For now, we keep the connection alive for future expansion

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    res.on("close", () => {
      clearInterval(heartbeat);
      res.end();
    });
  });

  /**
   * Health check endpoint
   */
  router.get("/mcp/health", (req: Request, res: Response) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
