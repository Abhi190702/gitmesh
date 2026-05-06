import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessRoutes } from "../api/access.js";
import { errorHandler } from "../infra/middleware/index.js";

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
  isInstanceAdmin: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listMembers: vi.fn(),
  setMemberPermissions: vi.fn(),
  promoteInstanceAdmin: vi.fn(),
  demoteInstanceAdmin: vi.fn(),
  listUserProjectAccess: vi.fn(),
  setUserProjectAccess: vi.fn(),
  setPrincipalGrants: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../core/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  deduplicateAgentName: vi.fn(),
  logActivity: mockLogActivity,
  notifyEnableApproved: vi.fn(),
}));

function createDbStub() {
  const createdInvite = {
    id: "invite-1",
    projectId: "project-1",
    inviteType: "project_join",
    allowedJoinTypes: "agent",
    defaultsPayload: null,
    expiresAt: new Date("2026-03-07T00:10:00.000Z"),
    invitedByUserId: null,
    tokenHash: "hash",
    revokedAt: null,
    acceptedAt: null,
    createdAt: new Date("2026-03-07T00:00:00.000Z"),
    updatedAt: new Date("2026-03-07T00:00:00.000Z"),
  };
  const returning = vi.fn().mockResolvedValue([createdInvite]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    insert,
  };
}

function createApp(actor: Record<string, unknown>, db: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use(
    "/api",
    accessRoutes(db as any, {
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    }),
  );
  app.use(errorHandler);
  return app;
}

describe("POST /projects/:projectId/gateway/invite-prompt", () => {
  beforeEach(() => {
    mockAccessService.canUser.mockResolvedValue(false);
    mockAgentService.getById.mockReset();
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("rejects non-CEO agent callers", async () => {
    const db = createDbStub();
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      projectId: "project-1",
      role: "general",
    });
    const app = createApp(
      {
        type: "agent",
        agentId: "agent-1",
        projectId: "project-1",
        source: "agent_key",
      },
      db,
    );

    const res = await request(app)
      .post("/api/projects/project-1/gateway/invite-prompt")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only CEO agents");
  });

  it("allows CEO agent callers and creates an agent-only invite", async () => {
    const db = createDbStub();
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      projectId: "project-1",
      role: "admin",
    });
    const app = createApp(
      {
        type: "agent",
        agentId: "agent-1",
        projectId: "project-1",
        source: "agent_key",
      },
      db,
    );

    const res = await request(app)
      .post("/api/projects/project-1/gateway/invite-prompt")
      .send({ agentMessage: "Join and configure Gateway gateway." });

    expect(res.status).toBe(201);
    expect(res.body.allowedJoinTypes).toBe("agent");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.onboardingTextPath).toContain("/api/invites/");
  });

  it("allows operator callers with invite permission", async () => {
    const db = createDbStub();
    mockAccessService.canUser.mockResolvedValue(true);
    const app = createApp(
      {
        type: "operator",
        userId: "user-1",
        projectIds: ["project-1"],
        source: "session",
        isInstanceAdmin: false,
      },
      db,
    );

    const res = await request(app)
      .post("/api/projects/project-1/gateway/invite-prompt")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.allowedJoinTypes).toBe("agent");
  });

  it("rejects operator callers without invite permission", async () => {
    const db = createDbStub();
    mockAccessService.canUser.mockResolvedValue(false);
    const app = createApp(
      {
        type: "operator",
        userId: "user-1",
        projectIds: ["project-1"],
        source: "session",
        isInstanceAdmin: false,
      },
      db,
    );

    const res = await request(app)
      .post("/api/projects/project-1/gateway/invite-prompt")
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Permission denied");
  });
});
