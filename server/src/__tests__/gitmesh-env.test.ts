import { afterEach, describe, expect, it } from "vitest";
import { buildGitmeshEnv as buildGitmeshAgentsEnv } from "../adapters/utils.js";

const ORIGINAL_GITMESH_API_URL = process.env.GITMESH_API_URL;
const ORIGINAL_GITMESH_LISTEN_HOST = process.env.GITMESH_LISTEN_HOST;
const ORIGINAL_GITMESH_LISTEN_PORT = process.env.GITMESH_LISTEN_PORT;
const ORIGINAL_HOST = process.env.HOST;
const ORIGINAL_PORT = process.env.PORT;

afterEach(() => {
  if (ORIGINAL_GITMESH_API_URL === undefined) delete process.env.GITMESH_API_URL;
  else process.env.GITMESH_API_URL = ORIGINAL_GITMESH_API_URL;

  if (ORIGINAL_GITMESH_LISTEN_HOST === undefined) delete process.env.GITMESH_LISTEN_HOST;
  else process.env.GITMESH_LISTEN_HOST = ORIGINAL_GITMESH_LISTEN_HOST;

  if (ORIGINAL_GITMESH_LISTEN_PORT === undefined) delete process.env.GITMESH_LISTEN_PORT;
  else process.env.GITMESH_LISTEN_PORT = ORIGINAL_GITMESH_LISTEN_PORT;

  if (ORIGINAL_HOST === undefined) delete process.env.HOST;
  else process.env.HOST = ORIGINAL_HOST;

  if (ORIGINAL_PORT === undefined) delete process.env.PORT;
  else process.env.PORT = ORIGINAL_PORT;
});

describe("buildGitmeshAgentsEnv", () => {
  it("prefers an explicit GITMESH_API_URL", () => {
    process.env.GITMESH_API_URL = "http://localhost:4100";
    process.env.GITMESH_LISTEN_HOST = "127.0.0.1";
    process.env.GITMESH_LISTEN_PORT = "3101";

    const env = buildGitmeshAgentsEnv({ id: "agent-1", projectId: "project-1" });

    expect(env.GITMESH_API_URL).toBe("http://localhost:4100");
  });

  it("uses runtime listen host/port when explicit URL is not set", () => {
    delete process.env.GITMESH_API_URL;
    process.env.GITMESH_LISTEN_HOST = "0.0.0.0";
    process.env.GITMESH_LISTEN_PORT = "3101";
    process.env.PORT = "3100";

    const env = buildGitmeshAgentsEnv({ id: "agent-1", projectId: "project-1" });

    expect(env.GITMESH_API_URL).toBe("http://localhost:3101");
  });

  it("formats IPv6 hosts safely in fallback URL generation", () => {
    delete process.env.GITMESH_API_URL;
    process.env.GITMESH_LISTEN_HOST = "::1";
    process.env.GITMESH_LISTEN_PORT = "3101";

    const env = buildGitmeshAgentsEnv({ id: "agent-1", projectId: "project-1" });

    expect(env.GITMESH_API_URL).toBe("http://[::1]:3101");
  });
});
