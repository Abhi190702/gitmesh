import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyDataDirOverride } from "../config/data-dir.js";
import { setupCliEnv } from "./_helpers/cli-fixtures.js";

describe("applyDataDirOverride", () => {
  setupCliEnv();

  // Each case is a triple of (label, invocation, assertions). The shared
  // env-reset comes from `setupCliEnv()` so individual cases stay tiny.
  it("sets GITMESH_HOME and isolated default config/context paths", () => {
    const home = applyDataDirOverride(
      { dataDir: "~/gitmesh-data", config: undefined, context: undefined },
      { hasConfigOption: true, hasContextOption: true },
    );

    const expectedHome = path.resolve(os.homedir(), "gitmesh-data");
    expect(home).toBe(expectedHome);
    expect(process.env.GITMESH_HOME).toBe(expectedHome);
    expect(process.env.GITMESH_CONFIG).toBe(
      path.resolve(expectedHome, "instances", "default", "gitmesh-agents.json"),
    );
    expect(process.env.GITMESH_CONTEXT).toBe(path.resolve(expectedHome, "context.json"));
    expect(process.env.GITMESH_INSTANCE_ID).toBe("default");
  });

  it("uses the provided instance id when deriving default config path", () => {
    const home = applyDataDirOverride(
      { dataDir: "/tmp/gitmesh-agents-alt", instance: "dev_1", config: undefined, context: undefined },
      { hasConfigOption: true, hasContextOption: true },
    );

    expect(home).toBe(path.resolve("/tmp/gitmesh-agents-alt"));
    expect(process.env.GITMESH_INSTANCE_ID).toBe("dev_1");
    expect(process.env.GITMESH_CONFIG).toBe(
      path.resolve("/tmp/gitmesh-agents-alt", "instances", "dev_1", "gitmesh-agents.json"),
    );
  });

  it("does not override explicit config/context settings", () => {
    process.env.GITMESH_CONFIG = "/env/config.json";
    process.env.GITMESH_CONTEXT = "/env/context.json";

    applyDataDirOverride(
      { dataDir: "/tmp/gitmesh-agents-alt", config: "/flag/config.json", context: "/flag/context.json" },
      { hasConfigOption: true, hasContextOption: true },
    );

    expect(process.env.GITMESH_CONFIG).toBe("/env/config.json");
    expect(process.env.GITMESH_CONTEXT).toBe("/env/context.json");
  });

  it("only applies defaults for options supported by the command", () => {
    applyDataDirOverride(
      { dataDir: "/tmp/gitmesh-agents-alt" },
      { hasConfigOption: false, hasContextOption: false },
    );

    expect(process.env.GITMESH_HOME).toBe(path.resolve("/tmp/gitmesh-agents-alt"));
    expect(process.env.GITMESH_CONFIG).toBeUndefined();
    expect(process.env.GITMESH_CONTEXT).toBeUndefined();
  });
});
