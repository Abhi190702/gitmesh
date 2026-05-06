import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveGitmeshHomeDir,
  resolveGitmeshInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.gitmesh-agents and default instance", () => {
    delete process.env.GITMESH_HOME;
    delete process.env.GITMESH_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".gitmesh-agents"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".gitmesh-agents", "instances", "default", "gitmesh-agents.json"));
  });

  it("supports GITMESH_HOME and explicit instance ids", () => {
    process.env.GITMESH_HOME = "~/gitmesh-agents-home";

    const home = resolveGitmeshHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "gitmesh-agents-home"));
    expect(resolveGitmeshInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveGitmeshInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
