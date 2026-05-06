export interface ProjectPortabilityInclude {
  project: boolean;
  agents: boolean;
}

export interface ProjectPortabilitySecretRequirement {
  key: string;
  description: string | null;
  agentSlug: string | null;
  providerHint: string | null;
}

export interface ProjectPortabilityProjectManifestEntry {
  path: string;
  name: string;
  description: string | null;
  brandColor: string | null;
  repoUrl?: string | null;
  forgeProvider?: "github" | "gitlab" | "forgejo" | null;
  forgeOwner?: string | null;
  forgeRepo?: string | null;
  requireOperatorApprovalForNewAgents: boolean;
}

export interface ProjectPortabilityAgentManifestEntry {
  slug: string;
  name: string;
  path: string;
  role: string;
  title: string | null;
  icon: string | null;
  capabilities: string | null;
  reportsToSlug: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  permissions: Record<string, unknown>;
  budgetMonthlyCents: number;
  metadata: Record<string, unknown> | null;
}

export interface ProjectPortabilityManifest {
  schemaVersion: number;
  generatedAt: string;
  source: {
    projectId: string;
    projectName: string;
  } | null;
  includes: ProjectPortabilityInclude;
  project: ProjectPortabilityProjectManifestEntry | null;
  agents: ProjectPortabilityAgentManifestEntry[];
  requiredSecrets: ProjectPortabilitySecretRequirement[];
}

export interface ProjectPortabilityExportResult {
  manifest: ProjectPortabilityManifest;
  files: Record<string, string>;
  warnings: string[];
}

export type ProjectPortabilitySource =
  | {
      type: "inline";
      manifest: ProjectPortabilityManifest;
      files: Record<string, string>;
    }
  | {
      type: "url";
      url: string;
    }
  | {
      type: "github";
      url: string;
    };

export type ProjectPortabilityImportTarget =
  | {
      mode: "new_project";
      newProjectName?: string | null;
    }
  | {
      mode: "existing_project";
      projectId: string;
    };

export type ProjectPortabilityAgentSelection = "all" | string[];

export type ProjectPortabilityCollisionStrategy = "rename" | "skip" | "replace";

export interface ProjectPortabilityPreviewRequest {
  source: ProjectPortabilitySource;
  include?: Partial<ProjectPortabilityInclude>;
  target: ProjectPortabilityImportTarget;
  agents?: ProjectPortabilityAgentSelection;
  collisionStrategy?: ProjectPortabilityCollisionStrategy;
}

export interface ProjectPortabilityPreviewAgentPlan {
  slug: string;
  action: "create" | "update" | "skip";
  plannedName: string;
  existingAgentId: string | null;
  reason: string | null;
}

export interface ProjectPortabilityPreviewResult {
  include: ProjectPortabilityInclude;
  targetProjectId: string | null;
  targetProjectName: string | null;
  collisionStrategy: ProjectPortabilityCollisionStrategy;
  selectedAgentSlugs: string[];
  plan: {
    projectAction: "none" | "create" | "update";
    agentPlans: ProjectPortabilityPreviewAgentPlan[];
  };
  requiredSecrets: ProjectPortabilitySecretRequirement[];
  warnings: string[];
  errors: string[];
}

export interface ProjectPortabilityImportRequest extends ProjectPortabilityPreviewRequest {}

export interface ProjectPortabilityImportResult {
  project: {
    id: string;
    name: string;
    action: "created" | "updated" | "unchanged";
  };
  agents: {
    slug: string;
    id: string | null;
    action: "created" | "updated" | "skipped";
    name: string;
    reason: string | null;
  }[];
  requiredSecrets: ProjectPortabilitySecretRequirement[];
  warnings: string[];
}

export interface ProjectPortabilityExportRequest {
  include?: Partial<ProjectPortabilityInclude>;
}
