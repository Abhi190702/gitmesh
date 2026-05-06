import { describe, expect, it } from "vitest";
import {
  defaultClientContext,
  readContext,
  setCurrentProfile,
  upsertProfile,
  writeContext,
} from "../client/context.js";
import { makeTempFilePath } from "./_helpers/cli-fixtures.js";

describe("client context store", () => {
  it("returns default context when file does not exist", () => {
    const contextPath = makeTempFilePath("context.json", "gitmesh-agents-cli-context-");
    expect(readContext(contextPath)).toEqual(defaultClientContext());
  });

  it("upserts profile values and switches current profile", () => {
    const contextPath = makeTempFilePath("context.json", "gitmesh-agents-cli-context-");
    const profile = {
      apiBase: "http://localhost:3100",
      projectId: "project-123",
      apiKeyEnvVarName: "GITMESH_AGENT_TOKEN",
    };

    upsertProfile("work", profile, contextPath);
    setCurrentProfile("work", contextPath);

    const context = readContext(contextPath);
    expect(context.currentProfile).toBe("work");
    expect(context.profiles.work).toEqual(profile);
  });

  it("normalizes invalid file content to safe defaults", () => {
    const contextPath = makeTempFilePath("context.json", "gitmesh-agents-cli-context-");
    writeContext(
      {
        version: 1,
        currentProfile: "x",
        profiles: {
          x: {
            apiBase: " ",
            projectId: " ",
            apiKeyEnvVarName: " ",
          },
        },
      },
      contextPath,
    );

    const context = readContext(contextPath);
    expect(context.currentProfile).toBe("x");
    expect(context.profiles.x).toEqual({});
  });
});
