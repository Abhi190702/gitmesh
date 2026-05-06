import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testEnvironment } from "@gitmesh/adapter-codex-local/server";
import {
  assertAdapterEnvironment,
  runEnvironmentCase,
  type EnvironmentScenario,
} from "./_helpers/adapter-test-harness.js";

interface CwdCtx { cwd: string }

const scenarios: EnvironmentScenario<CwdCtx>[] = [
  {
    name: "creates a missing working directory when cwd is absolute",
    arrange: async () => {
      const cwd = path.join(
        os.tmpdir(),
        `gitmesh-agents-codex-local-cwd-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        "workspace",
      );
      await fs.rm(path.dirname(cwd), { recursive: true, force: true });
      return {
        config: {
          projectId: "project-1",
          adapterType: "codex_local",
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
        codes: ["codex_cwd_valid"],
        forbidErrorLevel: true,
      });
    },
    postAssert: async ({ cwd }) => {
      const stats = await fs.stat(cwd);
      expect(stats.isDirectory()).toBe(true);
    },
  },
];

describe("codex_local environment diagnostics", () => {
  it.each(scenarios)("$name", async (scenario) => {
    await runEnvironmentCase(
      (config) => testEnvironment(config as Parameters<typeof testEnvironment>[0]),
      scenario,
    );
  });
});
