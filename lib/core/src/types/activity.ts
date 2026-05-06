export interface ActivityEvent {
  id: string;
  projectId: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  agentId: string | null;
  runId: string | null;
  details: Record<string, unknown> | null;
  /** Policy enforcement metadata */
  policyVersion: number | null;
  policyOutcome: "allowed" | "blocked" | "require_approval" | null;
  createdAt: Date;
}
