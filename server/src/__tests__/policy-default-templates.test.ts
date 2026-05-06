import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY_TEMPLATES } from "../core/policy-default-templates.js";

describe("default policy templates", () => {
  it("defines expected governance templates", () => {
    expect(DEFAULT_POLICY_TEMPLATES.length).toBeGreaterThanOrEqual(5);

    const names = DEFAULT_POLICY_TEMPLATES.map((template) => template.name);
    expect(names).toContain("Require approval for merge");
    expect(names).toContain("Require approval for security advisories");
    expect(names).toContain("Block direct push to main");
    expect(names).toContain("Allow triage actions");
    expect(names).toContain("Default allow");
  });

  it("includes a catch-all policy as the final fallback", () => {
    const fallback = DEFAULT_POLICY_TEMPLATES.find((template) => template.actionPattern === "*");
    expect(fallback).toBeDefined();
    expect(fallback?.effect).toBe("allow");
  });
});
