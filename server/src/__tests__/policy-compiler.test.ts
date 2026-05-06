import { describe, expect, it } from "vitest";
import { compilePoliciesFromYAML } from "../core/policy-compiler.js";

describe("policy compiler", () => {
  it("compiles valid YAML policy definitions", () => {
    const yaml = `
- name: Require merge approval
  actionPattern: merge_pr
  effect: require_approval
  effectConfig:
    approverRoles: [maintainer]
    timeout: 24h
  priority: 10

- name: Block direct push
  actionPattern: push
  conditions:
    targetBranch: [main, master]
  effect: block
  priority: 20
`;

    const result = compilePoliciesFromYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.policies).toHaveLength(2);
    expect(result.policies[0]).toMatchObject({
      name: "Require merge approval",
      actionPattern: "merge_pr",
      effect: "require_approval",
      priority: 10,
      enabled: true,
    });
    expect(result.policies[1]).toMatchObject({
      name: "Block direct push",
      effect: "block",
      priority: 20,
    });
  });

  it("returns validation errors for malformed YAML policy payload", () => {
    const yaml = `
- name: Missing effect policy
  actionPattern: merge_pr
`;

    const result = compilePoliciesFromYAML(yaml);

    expect(result.policies).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.error).toContain("effect");
  });
});
