import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@gitmesh/data";
import { notifyEnableApproved } from "../core/enable-hook.js";

// Mock the registry so we control whether the adapter has onEnableApproved and what it does.
vi.mock("../adapters/registry.js", () => ({
  findServerAdapter: vi.fn(),
}));

vi.mock("../core/activity-log.js", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

const { findServerAdapter } = await import("../adapters/registry.js");
const { logActivity } = await import("../core/activity-log.js");

function mockDbWithAgent(agent: { id: string; projectId: string; name: string; adapterType: string; adapterConfig?: Record<string, unknown> }): Db {
  return {
    select: () => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              id: agent.id,
              projectId: agent.projectId,
              name: agent.name,
              adapterType: agent.adapterType,
              adapterConfig: agent.adapterConfig ?? {},
            },
          ]),
      }),
    }),
  } as unknown as Db;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("notifyEnableApproved", () => {
  it("writes success activity when adapter hook returns ok", async () => {
    vi.mocked(findServerAdapter).mockReturnValue({
      type: "gateway",
      onEnableApproved: vi.fn().mockResolvedValue({ ok: true }),
    } as any);

    const db = mockDbWithAgent({
      id: "a1",
      projectId: "c1",
      name: "Gateway Agent",
      adapterType: "gateway",
    });

    await expect(
      notifyEnableApproved(db, {
        projectId: "c1",
        agentId: "a1",
        source: "approval",
        sourceId: "ap1",
      }),
    ).resolves.toBeUndefined();

    expect(logActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "enable_hook.succeeded",
        entityId: "a1",
        details: expect.objectContaining({ source: "approval", sourceId: "ap1", adapterType: "gateway" }),
      }),
    );
  });

  it("does nothing when agent is not found", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    } as unknown as Db;

    await expect(
      notifyEnableApproved(db, {
        projectId: "c1",
        agentId: "a1",
        source: "join_request",
        sourceId: "jr1",
      }),
    ).resolves.toBeUndefined();

    expect(findServerAdapter).not.toHaveBeenCalled();
  });

  it("does nothing when adapter has no onEnableApproved", async () => {
    vi.mocked(findServerAdapter).mockReturnValue({ type: "process" } as any);

    const db = mockDbWithAgent({
      id: "a1",
      projectId: "c1",
      name: "Agent",
      adapterType: "process",
    });

    await expect(
      notifyEnableApproved(db, {
        projectId: "c1",
        agentId: "a1",
        source: "approval",
        sourceId: "ap1",
      }),
    ).resolves.toBeUndefined();

    expect(findServerAdapter).toHaveBeenCalledWith("process");
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("logs failed result when adapter onEnableApproved returns ok=false", async () => {
    vi.mocked(findServerAdapter).mockReturnValue({
      type: "gateway",
      onEnableApproved: vi.fn().mockResolvedValue({ ok: false, error: "HTTP 500", detail: { status: 500 } }),
    } as any);

    const db = mockDbWithAgent({
      id: "a1",
      projectId: "c1",
      name: "Gateway Agent",
      adapterType: "gateway",
    });

    await expect(
      notifyEnableApproved(db, {
        projectId: "c1",
        agentId: "a1",
        source: "join_request",
        sourceId: "jr1",
      }),
    ).resolves.toBeUndefined();

    expect(logActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "enable_hook.failed",
        entityId: "a1",
        details: expect.objectContaining({ source: "join_request", sourceId: "jr1", error: "HTTP 500" }),
      }),
    );
  });

  it("does not throw when adapter onEnableApproved throws (non-fatal)", async () => {
    vi.mocked(findServerAdapter).mockReturnValue({
      type: "gateway",
      onEnableApproved: vi.fn().mockRejectedValue(new Error("Network error")),
    } as any);

    const db = mockDbWithAgent({
      id: "a1",
      projectId: "c1",
      name: "Gateway Agent",
      adapterType: "gateway",
    });

    await expect(
      notifyEnableApproved(db, {
        projectId: "c1",
        agentId: "a1",
        source: "join_request",
        sourceId: "jr1",
      }),
    ).resolves.toBeUndefined();

    expect(logActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "enable_hook.error",
        entityId: "a1",
        details: expect.objectContaining({ source: "join_request", sourceId: "jr1", error: "Network error" }),
      }),
    );
  });
});
