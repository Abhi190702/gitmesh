import { describe, expect, it } from "vitest";
import { resolveCommandContext } from "../commands/client/common.js";
import {
  buildSingleProfileContext,
  seedContextFile,
  setupCliEnv,
} from "./_helpers/cli-fixtures.js";

describe("resolveCommandContext", () => {
  setupCliEnv(["AGENT_KEY"]);

  it("uses profile defaults when options/env are not provided", () => {
    const contextPath = seedContextFile(
      buildSingleProfileContext("ops", {
        apiBase: "http://127.0.0.1:9999",
        projectId: "project-profile",
        apiKeyEnvVarName: "AGENT_KEY",
      }),
    );
    process.env.AGENT_KEY = "key-from-env";

    const resolved = resolveCommandContext({ context: contextPath }, { requireProject: true });

    expect(resolved.api.apiBase).toBe("http://127.0.0.1:9999");
    expect(resolved.projectId).toBe("project-profile");
    expect(resolved.api.apiKey).toBe("key-from-env");
  });

  it("prefers explicit options over profile values", () => {
    const contextPath = seedContextFile(
      buildSingleProfileContext("default", {
        apiBase: "http://profile:3100",
        projectId: "project-profile",
      }),
    );

    const resolved = resolveCommandContext(
      {
        context: contextPath,
        apiBase: "http://override:3200",
        apiKey: "direct-token",
        projectId: "project-override",
      },
      { requireProject: true },
    );

    expect(resolved.api.apiBase).toBe("http://override:3200");
    expect(resolved.projectId).toBe("project-override");
    expect(resolved.api.apiKey).toBe("direct-token");
  });

  it("throws when project is required but unresolved", () => {
    const contextPath = seedContextFile(
      buildSingleProfileContext("default", {}),
    );

    expect(() =>
      resolveCommandContext(
        { context: contextPath, apiBase: "http://localhost:3100" },
        { requireProject: true },
      ),
    ).toThrow(/Project ID is required/);
  });
});
