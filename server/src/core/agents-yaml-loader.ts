/**
 * .gitmesh/agents.yaml Config Loader
 *
 * Reads and validates the in-repo `.gitmesh/agents.yaml` configuration file
 * from a project's repository. Used during project setup and heartbeat sync
 * to reconcile declared agents/policies with the database state.
 */

import { AGENT_ROLES, type AgentRole } from "@gitmesh/core";

export interface AgentYamlConfig {
    agents: AgentDeclaration[];
    policies: PolicyDeclaration[];
}

export interface AgentDeclaration {
    name: string;
    role: string;
    schedule?: string;
    triggers?: string[];
    budget: number;
    requires_approval?: boolean;
}

export interface PolicyDeclaration {
    name: string;
    actionPattern: string;
    conditions?: Record<string, unknown>;
    effect: "allow" | "block" | "require_approval";
    priority?: number;
}

export interface ValidationError {
    path: string;
    message: string;
}

export interface ParseResult {
    config: AgentYamlConfig | null;
    errors: ValidationError[];
}

/**
 * Parse and validate a raw YAML object (already parsed from .gitmesh/agents.yaml)
 */
export function parseAgentsYaml(raw: unknown): ParseResult {
    const errors: ValidationError[] = [];

    if (!raw || typeof raw !== "object") {
        return { config: null, errors: [{ path: "root", message: "Config must be a YAML object" }] };
    }

    const obj = raw as Record<string, unknown>;
    const agents: AgentDeclaration[] = [];
    const policies: PolicyDeclaration[] = [];

    // Parse agents
    if (obj.agents) {
        if (!Array.isArray(obj.agents)) {
            errors.push({ path: "agents", message: "agents must be an array" });
        } else {
            for (let i = 0; i < obj.agents.length; i++) {
                const entry = obj.agents[i];
                if (!entry || typeof entry !== "object") {
                    errors.push({ path: `agents[${i}]`, message: "Agent entry must be an object" });
                    continue;
                }

                const agent = entry as Record<string, unknown>;

                // Validate name
                if (!agent.name || typeof agent.name !== "string") {
                    errors.push({ path: `agents[${i}].name`, message: "Agent name is required and must be a string" });
                    continue;
                }

                // Validate role
                if (!agent.role || typeof agent.role !== "string") {
                    errors.push({ path: `agents[${i}].role`, message: "Agent role is required" });
                    continue;
                }

                const validRoles = AGENT_ROLES as readonly string[];
                if (!validRoles.includes(agent.role)) {
                    errors.push({
                        path: `agents[${i}].role`,
                        message: `Invalid role '${agent.role}'. Valid roles: ${AGENT_ROLES.join(", ")}`,
                    });
                    continue;
                }

                // Validate budget
                const budget = typeof agent.budget === "number" ? agent.budget : 5000;
                if (budget < 0) {
                    errors.push({ path: `agents[${i}].budget`, message: "Budget must be >= 0" });
                    continue;
                }

                // Validate schedule
                const schedule = typeof agent.schedule === "string" ? agent.schedule : undefined;

                // Validate triggers
                let triggers: string[] | undefined;
                if (agent.triggers) {
                    if (!Array.isArray(agent.triggers)) {
                        errors.push({ path: `agents[${i}].triggers`, message: "Triggers must be an array of strings" });
                    } else {
                        triggers = agent.triggers.filter((t): t is string => typeof t === "string");
                    }
                }

                agents.push({
                    name: agent.name as string,
                    role: agent.role as string,
                    schedule,
                    triggers,
                    budget,
                    requires_approval: agent.requires_approval === true,
                });
            }
        }
    }

    // Parse policies
    if (obj.policies) {
        if (!Array.isArray(obj.policies)) {
            errors.push({ path: "policies", message: "policies must be an array" });
        } else {
            for (let i = 0; i < obj.policies.length; i++) {
                const entry = obj.policies[i];
                if (!entry || typeof entry !== "object") {
                    errors.push({ path: `policies[${i}]`, message: "Policy entry must be an object" });
                    continue;
                }

                const policy = entry as Record<string, unknown>;

                // Validate name
                if (!policy.name || typeof policy.name !== "string") {
                    errors.push({ path: `policies[${i}].name`, message: "Policy name is required" });
                    continue;
                }

                // Validate actionPattern
                if (!policy.actionPattern || typeof policy.actionPattern !== "string") {
                    errors.push({ path: `policies[${i}].actionPattern`, message: "actionPattern is required" });
                    continue;
                }

                // Validate effect
                const validEffects = ["allow", "block", "require_approval"];
                if (!policy.effect || !validEffects.includes(policy.effect as string)) {
                    errors.push({
                        path: `policies[${i}].effect`,
                        message: `effect must be one of: ${validEffects.join(", ")}`,
                    });
                    continue;
                }

                // Validate priority
                const priority = typeof policy.priority === "number" ? policy.priority : undefined;

                // Validate conditions
                const conditions = (typeof policy.conditions === "object" && policy.conditions !== null && !Array.isArray(policy.conditions))
                    ? policy.conditions as Record<string, unknown>
                    : undefined;

                policies.push({
                    name: policy.name as string,
                    actionPattern: policy.actionPattern as string,
                    conditions,
                    effect: policy.effect as "allow" | "block" | "require_approval",
                    priority,
                });
            }
        }
    }

    if (agents.length === 0 && policies.length === 0 && errors.length === 0) {
        errors.push({ path: "root", message: "Config must define at least one agent or policy" });
    }

    return {
        config: errors.length === 0 ? { agents, policies } : null,
        errors,
    };
}

/**
 * Compute a diff between declared agents.yaml config and the current DB state.
 * Returns agents to add, remove, or update.
 */
export function diffAgentConfig(
    declared: AgentDeclaration[],
    existing: Array<{ name: string; role: string; id: string }>,
): {
    toAdd: AgentDeclaration[];
    toRemove: Array<{ name: string; role: string; id: string }>;
    toUpdate: Array<{ id: string; updates: Partial<AgentDeclaration> }>;
} {
    const toAdd: AgentDeclaration[] = [];
    const toRemove: Array<{ name: string; role: string; id: string }> = [];
    const toUpdate: Array<{ id: string; updates: Partial<AgentDeclaration> }> = [];

    const existingByRole = new Map<string, (typeof existing)[0]>();
    for (const agent of existing) {
        existingByRole.set(agent.role, agent);
    }

    const declaredRoles = new Set<string>();

    for (const decl of declared) {
        declaredRoles.add(decl.role);
        const match = existingByRole.get(decl.role);

        if (!match) {
            toAdd.push(decl);
        } else if (match.name !== decl.name) {
            toUpdate.push({ id: match.id, updates: { name: decl.name } });
        }
    }

    for (const agent of existing) {
        if (!declaredRoles.has(agent.role)) {
            toRemove.push(agent);
        }
    }

    return { toAdd, toRemove, toUpdate };
}
