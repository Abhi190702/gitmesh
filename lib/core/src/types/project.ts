import type { ProjectOrgStatus } from "../constants.js";

export type ForgeProvider = "github" | "gitlab" | "forgejo" | "tekton";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectOrgStatus;
  issuePrefix: string;
  issueCounter: number;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  requireOperatorApprovalForNewAgents: boolean;
  brandColor: string | null;
  /** URL of the connected forge repository */
  repoUrl: string | null;
  /** Forge provider type */
  forgeProvider: ForgeProvider | null;
  /** Owner/org on the forge */
  forgeOwner: string | null;
  /** Repository name on the forge */
  forgeRepo: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Last time issues were pulled from the forge */
  lastSyncedAt: Date | null;
}

export interface SubprojectWorkspace {
  id: string;
  projectId: string;
  subprojectId: string;
  name: string;
  cwd: string | null;
  repoUrl: string | null;
  repoRef: string | null;
  metadata: Record<string, unknown> | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subproject {
  id: string;
  projectId: string;
  goalId: string | null;
  name: string;
  description: string | null;
  status: string;
  leadAgentId: string | null;
  targetDate: string | null;
  color: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** URL key for routing */
  urlKey?: string | null;
  /** Enrichment: linked goal IDs */
  goalIds?: string[];
  /** Enrichment: linked goals with title */
  goals?: Array<{ id: string; title: string }>;
  /** Enrichment: attached workspaces */
  workspaces?: SubprojectWorkspace[];
  /** Enrichment: linked milestone IDs (alias for goalIds) */
  milestoneIds?: string[];
  /** Enrichment: primary milestone ID (alias for goalId) */
  milestoneId?: string | null;
}
