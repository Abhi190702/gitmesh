import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { projectRoutes } from "../api/projects.js";

vi.mock("../services/index.js", () => ({
  projectService: () => ({
    list: vi.fn(),
    stats: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  }),
  projectPortabilityService: () => ({
    exportBundle: vi.fn(),
    previewImport: vi.fn(),
    importBundle: vi.fn(),
  }),
  accessService: () => ({
    canUser: vi.fn(),
    ensureMembership: vi.fn(),
  }),
  logActivity: vi.fn(),
}));

describe("project routes malformed issue path guard", () => {
  it("returns a clear error when projectId is missing for issues list path", async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).actor = {
        type: "agent",
        agentId: "agent-1",
        projectId: "project-1",
        source: "agent_key",
      };
      next();
    });
    app.use("/api/projects", projectRoutes({} as any));

    const res = await request(app).get("/api/projects/issues");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Missing projectId in path. Use /api/projects/{projectId}/issues.",
    });
  });
});
