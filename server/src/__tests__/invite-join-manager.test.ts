import { describe, expect, it } from "vitest";
import { resolveJoinRequestAgentManagerId } from "../api/access.js";

describe("resolveJoinRequestAgentManagerId", () => {
  it("returns null when no CEO exists in the project agent list", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "a1", role: "pr_review", reportsTo: null },
      { id: "a2", role: "general", reportsTo: "a1" },
    ]);

    expect(managerId).toBeNull();
  });

  it("selects the root CEO when available", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "admin-child", role: "admin", reportsTo: "manager-1" },
      { id: "manager-1", role: "pr_review", reportsTo: null },
      { id: "admin-root", role: "admin", reportsTo: null },
    ]);

    expect(managerId).toBe("admin-root");
  });

  it("falls back to the first CEO when no root CEO is present", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "admin-1", role: "admin", reportsTo: "mgr" },
      { id: "admin-2", role: "admin", reportsTo: "mgr" },
      { id: "mgr", role: "pr_review", reportsTo: null },
    ]);

    expect(managerId).toBe("admin-1");
  });
});
