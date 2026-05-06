import { beforeEach, describe, expect, it } from "vitest";
import { hasAgentShortnameCollision, deduplicateAgentName } from "../core/agents.js";
import { makeAgent, makeAgentFleet, resetFactoryCounters } from "./_helpers/factories.js";

beforeEach(() => {
  resetFactoryCounters();
});

describe("hasAgentShortnameCollision", () => {
  it("detects collisions by normalized shortname", () => {
    const fleet = [makeAgent({ id: "a1", name: "codex-coder" })];
    expect(hasAgentShortnameCollision("Codex Coder", fleet)).toBe(true);
  });

  it("ignores terminated agents", () => {
    const fleet = [makeAgent({ id: "a1", name: "codex-coder", status: "terminated" })];
    expect(hasAgentShortnameCollision("Codex Coder", fleet)).toBe(false);
  });

  it("ignores the excluded agent id", () => {
    const fleet = [
      makeAgent({ id: "a1", name: "codex-coder" }),
      makeAgent({ id: "a2", name: "other-agent" }),
    ];
    expect(
      hasAgentShortnameCollision("Codex Coder", fleet, { excludeAgentId: "a1" }),
    ).toBe(false);
  });

  it("does not collide when candidate has no shortname", () => {
    const fleet = [makeAgent({ id: "a1", name: "codex-coder" })];
    expect(hasAgentShortnameCollision("!!!", fleet)).toBe(false);
  });
});

describe("deduplicateAgentName", () => {
  it("returns original name when no collision", () => {
    const fleet = [makeAgent({ id: "a1", name: "other-agent" })];
    expect(deduplicateAgentName("Gateway", fleet)).toBe("Gateway");
  });

  it("appends suffix when name collides", () => {
    const fleet = [makeAgent({ id: "a1", name: "gateway" })];
    expect(deduplicateAgentName("Gateway", fleet)).toBe("Gateway 2");
  });

  it("increments suffix until unique", () => {
    // makeAgentFleet generates `gateway`, `gateway-2`, `gateway-3` for count=3
    const fleet = makeAgentFleet(3, "gateway");
    expect(deduplicateAgentName("Gateway", fleet)).toBe("Gateway 4");
  });

  it("ignores terminated agents for collision", () => {
    const fleet = [makeAgent({ id: "a1", name: "gateway-agent", status: "terminated" })];
    expect(deduplicateAgentName("Gateway", fleet)).toBe("Gateway");
  });
});
