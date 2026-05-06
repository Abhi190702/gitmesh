import { describe, expect, it } from "vitest";
import type { Project } from "@gitmesh/core";
import { assertDeleteConfirmation, resolveProjectForDeletion } from "../commands/client/project.js";

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Alpha",
    description: null,
    status: "active",
    issuePrefix: "ALP",
    issueCounter: 1,
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    requireOperatorApprovalForNewAgents: false,
    brandColor: null,
    repoUrl: null,
    forgeProvider: null,
    forgeOwner: null,
    forgeRepo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncedAt: null,
    ...overrides,
  };
}

describe("resolveProjectForDeletion", () => {
  const projects: Project[] = [
    makeProject({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Alpha",
      issuePrefix: "ALP",
    }),
    makeProject({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Gitmesh",
      issuePrefix: "PAP",
    }),
  ];

  it("resolves by ID in auto mode", () => {
    const result = resolveProjectForDeletion(projects, "22222222-2222-2222-2222-222222222222", "auto");
    expect(result.issuePrefix).toBe("PAP");
  });

  it("resolves by prefix in auto mode", () => {
    const result = resolveProjectForDeletion(projects, "pap", "auto");
    expect(result.id).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("throws when selector is not found", () => {
    expect(() => resolveProjectForDeletion(projects, "MISSING", "auto")).toThrow(/No project found/);
  });

  it("respects explicit id mode", () => {
    expect(() => resolveProjectForDeletion(projects, "PAP", "id")).toThrow(/No project found by ID/);
  });

  it("respects explicit prefix mode", () => {
    expect(() => resolveProjectForDeletion(projects, "22222222-2222-2222-2222-222222222222", "prefix"))
      .toThrow(/No project found by shortname/);
  });
});

describe("assertDeleteConfirmation", () => {
  const project = makeProject({
    id: "22222222-2222-2222-2222-222222222222",
    issuePrefix: "PAP",
  });

  it("requires --yes", () => {
    expect(() => assertDeleteConfirmation(project, { confirm: "PAP" })).toThrow(/requires --yes/);
  });

  it("accepts matching prefix confirmation", () => {
    expect(() => assertDeleteConfirmation(project, { yes: true, confirm: "pap" })).not.toThrow();
  });

  it("accepts matching id confirmation", () => {
    expect(() =>
      assertDeleteConfirmation(project, {
        yes: true,
        confirm: "22222222-2222-2222-2222-222222222222",
      })).not.toThrow();
  });

  it("rejects mismatched confirmation", () => {
    expect(() => assertDeleteConfirmation(project, { yes: true, confirm: "nope" }))
      .toThrow(/does not match target project/);
  });
});
