export type CheckLevel = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  status: CheckLevel;
  message: string;
  canRepair?: boolean;
  repair?: () => void | Promise<void>;
  repairHint?: string;
}

/**
 * Derives an overall status from a list of check results.
 * Returns "fail" if any check failed, "warn" if any warned, otherwise "pass".
 */
export function summarizeCheckResults(results: CheckResult[]): CheckLevel {
  if (results.some((r) => r.status === "fail")) return "fail";
  if (results.some((r) => r.status === "warn")) return "warn";
  return "pass";
}

export { agentJwtSecretCheck } from "./agent-jwt-secret-check.js";
export { configCheck } from "./config-check.js";
export { deploymentAuthCheck } from "./deployment-auth-check.js";
export { databaseCheck } from "./database-check.js";
export { llmCheck } from "./llm-check.js";
export { logCheck } from "./log-check.js";
export { portCheck } from "./port-check.js";
export { secretsCheck } from "./secrets-check.js";
export { storageCheck } from "./storage-check.js";
