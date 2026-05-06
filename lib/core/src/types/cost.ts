export interface CostEvent {
  id: string;
  projectId: string;
  agentId: string;
  issueId: string | null;
  subprojectId: string | null;
  goalId: string | null;
  billingCode: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  occurredAt: Date;
  createdAt: Date;
}

export interface CostSummary {
  projectId: string;
  spendCents: number;
  budgetCents: number;
  utilizationPercent: number;
}

export interface CostByAgent {
  agentId: string;
  agentName: string | null;
  agentStatus: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
  apiRunCount: number;
  subscriptionRunCount: number;
  subscriptionInputTokens: number;
  subscriptionOutputTokens: number;
}
