import { describe, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testEnvironment } from "@gitmesh/adapter-opencode-local/server";
import {
  assertAdapterEnvironment,
  runEnvironmentCase,
  type EnvironmentScenario,
} from "./_helpers/adapter-test-harness.js";

interface OpencodeEnvCtx {
  cwd?: string;
  binDir?: string;
  originalOpenAiKey?: string | undefined;
}

const scenarios: EnvironmentScenario<OpencodeEnvCtx>[] = [
  {
    name: "reports a missing working directory as an error when cwd is absolute",
    arrange: async () => {
      const cwd = path.join(
        os.tmpdir(),
        `gitmesh-agents-opencode-local-cwd-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`,
        "workspace",
      );
      await fs.rm(path.dirname(cwd), { recursive: true, force: true });
      return {
        config: {
          projectId: "project-1",
          adapterType: "opencode_local",
          config: { command: process.execPath, cwd },
        },
        ctx: { cwd },
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        status: "fail",
        codes: ["opencode_cwd_invalid"],
        codeLevel: [{ code: "opencode_cwd_invalid", level: "error" }],
      });
    },
  },
  {
    name: "treats an empty OPENAI_API_KEY override as missing",
    arrange: async () => {
      const cwd = await fs.mkdtemp(
        path.join(os.tmpdir(), "gitmesh-agents-opencode-env-empty-key-"),
      );
      const originalOpenAiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "sk-host-value";
      return {
        config: {
          projectId: "project-1",
          adapterType: "opencode_local",
          config: {
            command: process.execPath,
            cwd,
            env: { OPENAI_API_KEY: "" },
          },
        },
        ctx: { cwd, originalOpenAiKey },
        cleanup: async () => {
          if (originalOpenAiKey === undefined) {
            delete process.env.OPENAI_API_KEY;
          } else {
            process.env.OPENAI_API_KEY = originalOpenAiKey;
          }
          await fs.rm(cwd, { recursive: true, force: true });
        },
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        codes: ["opencode_openai_api_key_missing"],
        hintContains: {
          code: "opencode_openai_api_key_missing",
          substring: "empty",
        },
      });
    },
  },
  {
    name: "classifies ProviderModelNotFoundError probe output as model-unavailable warning",
    arrange: async () => {
      const cwd = await fs.mkdtemp(
        path.join(os.tmpdir(), "gitmesh-agents-opencode-env-probe-cwd-"),
      );
      const binDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "gitmesh-agents-opencode-env-probe-bin-"),
      );
      const fakeOpencode = path.join(binDir, "opencode");
      const script = [
        "#!/bin/sh",
        "echo 'ProviderModelNotFoundError: ProviderModelNotFoundError' 1>&2",
        "echo 'data: { providerID: \"openai\", modelID: \"gpt-5.3-codex\", suggestions: [] }' 1>&2",
        "exit 1",
        "",
      ].join("\n");
      await fs.writeFile(fakeOpencode, script, "utf8");
      await fs.chmod(fakeOpencode, 0o755);

      return {
        config: {
          projectId: "project-1",
          adapterType: "opencode_local",
          config: { command: fakeOpencode, cwd },
        },
        ctx: { cwd, binDir },
        cleanup: async () => {
          await fs.rm(cwd, { recursive: true, force: true });
          await fs.rm(binDir, { recursive: true, force: true });
        },
      };
    },
    expect: (result) => {
      assertAdapterEnvironment(result, {
        status: "warn",
        codes: ["opencode_hello_probe_model_unavailable"],
        codeLevel: [
          { code: "opencode_hello_probe_model_unavailable", level: "warn" },
        ],
      });
    },
  },
];

describe("opencode_local environment diagnostics", () => {
  it.each(scenarios)("$name", async (scenario) => {
    await runEnvironmentCase(
      (config) => testEnvironment(config as Parameters<typeof testEnvironment>[0]),
      scenario,
    );
  });
});
