/**
 * Policy Compiler Service
 *
 * Compiles declarative YAML policy definitions into internal policy objects.
 * Handles validation, default values, and error reporting.
 */

import YAML from "js-yaml";

export interface YAMLPolicy {
  name: string;
  description?: string;
  actionPattern: string | string[];
  conditions?: Record<string, string | string[]>;
  effect: "allow" | "block" | "require_approval";
  effectConfig?: Record<string, unknown>;
  priority?: number;
  enabled?: boolean;
}

export interface CompiledPolicy {
  name: string;
  description: string | null;
  actionPattern: string;
  conditions: Record<string, unknown> | null;
  effect: "allow" | "block" | "require_approval";
  effectConfig: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
}

export interface PolicyCompileError {
  index: number;
  policy: string;
  error: string;
}

/**
 * Compile YAML policy document into an array of validated policy objects.
 * YAML should be an array of policy definitions.
 *
 * @example
 * ```yaml
 * - name: "Require approval for merge"
 *   actionPattern: "merge_pr"
 *   effect: "require_approval"
 *   effectConfig:
 *     approverRoles: ["maintainer"]
 *     timeout: "24h"
 *   priority: 10
 *
 * - name: "Block direct push to main"
 *   actionPattern: "push"
 *   conditions:
 *     targetBranch: ["main", "master"]
 *   effect: "block"
 *   priority: 20
 * ```
 */
export function compilePoliciesFromYAML(yamlContent: string): {
  policies: CompiledPolicy[];
  errors: PolicyCompileError[];
} {
  const policies: CompiledPolicy[] = [];
  const errors: PolicyCompileError[] = [];

  try {
    const parsed = YAML.load(yamlContent);

    if (!Array.isArray(parsed)) {
      return {
        policies: [],
        errors: [{ index: 0, policy: "root", error: "Policy document must be an array of policies" }],
      };
    }

    for (let i = 0; i < parsed.length; i++) {
      const policy = parsed[i];

      try {
        const compiled = compilePolicy(policy, i);
        policies.push(compiled);
      } catch (error) {
        errors.push({
          index: i,
          policy: policy?.name ?? `policy[${i}]`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    return {
      policies: [],
      errors: [
        {
          index: 0,
          policy: "root",
          error: `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }

  return { policies, errors };
}

/**
 * Compile a single policy definition into a validated policy object.
 */
function compilePolicy(raw: unknown, index: number): CompiledPolicy {
  if (!isObject(raw)) {
    throw new Error(`Policy at index ${index} must be an object`);
  }

  const { name, description, actionPattern, conditions, effect, effectConfig, priority, enabled } = raw;

  // Validate required fields
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Policy must have a non-empty 'name' field");
  }

  if (!actionPattern) {
    throw new Error("Policy must have an 'actionPattern' field");
  }

  // actionPattern can be a string or array of strings; normalize to single string
  let normalizedActionPattern: string;
  if (typeof actionPattern === "string") {
    normalizedActionPattern = actionPattern;
  } else if (Array.isArray(actionPattern)) {
    // If multiple patterns, use a compound pattern with |
    normalizedActionPattern = actionPattern.map((p) => String(p)).join("|");
  } else {
    throw new Error("'actionPattern' must be a string or array of strings");
  }

  if (!normalizedActionPattern) {
    throw new Error("'actionPattern' cannot be empty");
  }

  if (typeof effect !== "string" || !["allow", "block", "require_approval"].includes(effect)) {
    throw new Error("'effect' must be one of: allow, block, require_approval");
  }

  // Normalize conditions
  let normalizedConditions: Record<string, unknown> | null = null;
  if (conditions) {
    if (!isObject(conditions)) {
      throw new Error("'conditions' must be an object");
    }
    // Normalize string values to arrays
    normalizedConditions = {};
    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === "string") {
        normalizedConditions[key] = [value];
      } else if (Array.isArray(value)) {
        normalizedConditions[key] = value.map(String);
      } else {
        normalizedConditions[key] = [String(value)];
      }
    }
  }

  return {
    name: name.trim(),
    description: typeof description === "string" ? description.trim() || null : null,
    actionPattern: normalizedActionPattern,
    conditions: normalizedConditions,
    effect: effect as "allow" | "block" | "require_approval",
    effectConfig: isObject(effectConfig) ? effectConfig : null,
    priority: typeof priority === "number" ? priority : 100,
    enabled: typeof enabled === "boolean" ? enabled : true,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Convert a compiled policy back to YAML representation for storage.
 */
export function policyToYAML(policy: CompiledPolicy): string {
  const obj: Record<string, unknown> = {
    name: policy.name,
    actionPattern: policy.actionPattern,
    effect: policy.effect,
  };

  if (policy.description) obj.description = policy.description;
  if (policy.conditions) obj.conditions = policy.conditions;
  if (policy.effectConfig) obj.effectConfig = policy.effectConfig;
  if (policy.priority !== 100) obj.priority = policy.priority;
  if (!policy.enabled) obj.enabled = policy.enabled;

  return YAML.dump(obj);
}
