import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testEnvironment } from "@gitmesh/adapter-claude-local/server";
import {
  assertAdapterEnvironment,
  runEnvironmentCase,
  type EnvironmentScenario,
} from "./_helpers/adapter-test-harness.js";

const ORIGINAL_ANTHROPIC = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  if (ORIGINAL_ANTHROPIC === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC;
  }
});

interface ClaudeEnvCtx {
  cwd?: string;
}

const scenarios: EnvironmentScenario<ClaudeEnvCtx>[] = [
  {
    name: "returns a warning (not an error) when ANTHROPIC_API_KEY is set in host environment",
    arrange: async () => {
      process.env.ANTHROPIC_API_KEY = "sk-test-host";
      return {
        config: {
          projectId: "project-1",
          adapterType: "claude_local",
          config: { command: process.execPath, cwd: process.cwd() },
        },
        ctx: {},
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        status: "warn",
        codeLevel: [
          { code: "claude_anthropic_api_key_overrides_subscription", level: "warn" },
        ],
        forbidErrorLevel: true,
      });
    },
  },
  {
    name: "returns a warning (not an error) when ANTHROPIC_API_KEY is set in adapter env",
    arrange: async () => {
      delete process.env.ANTHROPIC_API_KEY;
      return {
        config: {
          projectId: "project-1",
          adapterType: "claude_local",
          config: {
            command: process.execPath,
            cwd: process.cwd(),
            env: { ANTHROPIC_API_KEY: "sk-test-config" },
          },
        },
        ctx: {},
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        status: "warn",
        codeLevel: [
          { code: "claude_anthropic_api_key_overrides_subscription", level: "warn" },
        ],
        forbidErrorLevel: true,
      });
    },
  },
  {
    name: "creates a missing working directory when cwd is absolute",
    arrange: async () => {
      const cwd = path.join(
        os.tmpdir(),
        `gitmesh-agents-claude-local-cwd-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        "workspace",
      );
      await fs.rm(path.dirname(cwd), { recursive: true, force: true });
      return {
        config: {
          projectId: "project-1",
          adapterType: "claude_local",
          config: { command: process.execPath, cwd },
        },
        ctx: { cwd },
        cleanup: async () => {
          await fs.rm(path.dirname(cwd), { recursive: true, force: true });
        },
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        codes: ["claude_cwd_valid"],
        forbidErrorLevel: true,
      });
    },
    postAssert: async ({ cwd }) => {
      const stats = await fs.stat(cwd as string);
      expect(stats.isDirectory()).toBe(true);
    },
  },
];

describe("claude_local environment diagnostics", () => {
  it.each(scenarios)("$name", async (scenario) => {
    await runEnvironmentCase(
      (config) => testEnvironment(config as Parameters<typeof testEnvironment>[0]),
      scenario,
    );
  });
});
