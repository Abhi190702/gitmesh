import { z } from "zod";

export const portabilityIncludeSchema = z
  .object({
    project: z.boolean().optional(),
    agents: z.boolean().optional(),
  })
  .partial();

export const portabilitySecretRequirementSchema = z.object({
  key: z.string().min(1),
  description: z.string().nullable(),
  agentSlug: z.string().min(1).nullable(),
  providerHint: z.string().nullable(),
});

export const portabilityProjectManifestEntrySchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  brandColor: z.string().nullable(),
  repoUrl: z.string().url().nullable().optional(),
  forgeProvider: z.enum(["github", "gitlab", "forgejo"]).nullable().optional(),
  forgeOwner: z.string().min(1).nullable().optional(),
  forgeRepo: z.string().min(1).nullable().optional(),
  requireOperatorApprovalForNewAgents: z.boolean(),
});

export const portabilityAgentManifestEntrySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
  title: z.string().nullable(),
  icon: z.string().nullable(),
  capabilities: z.string().nullable(),
  reportsToSlug: z.string().min(1).nullable(),
  adapterType: z.string().min(1),
  adapterConfig: z.record(z.unknown()),
  runtimeConfig: z.record(z.unknown()),
  permissions: z.record(z.unknown()),
  budgetMonthlyCents: z.number().int().nonnegative(),
  metadata: z.record(z.unknown()).nullable(),
});

export const portabilityManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string().datetime(),
  source: z
    .object({
      projectId: z.string().uuid(),
      projectName: z.string().min(1),
    })
    .nullable(),
  includes: z.object({
    project: z.boolean(),
    agents: z.boolean(),
  }),
  project: portabilityProjectManifestEntrySchema.nullable(),
  agents: z.array(portabilityAgentManifestEntrySchema),
  requiredSecrets: z.array(portabilitySecretRequirementSchema).default([]),
});

export const portabilitySourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("inline"),
    manifest: portabilityManifestSchema,
    files: z.record(z.string()),
  }),
  z.object({
    type: z.literal("url"),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal("github"),
    url: z.string().url(),
  }),
]);

export const portabilityTargetSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new_project"),
    newProjectName: z.string().min(1).optional().nullable(),
  }),
  z.object({
    mode: z.literal("existing_project"),
    projectId: z.string().uuid(),
  }),
]);

export const portabilityAgentSelectionSchema = z.union([
  z.literal("all"),
  z.array(z.string().min(1)),
]);

export const portabilityCollisionStrategySchema = z.enum(["rename", "skip", "replace"]);

export const projectPortabilityExportSchema = z.object({
  include: portabilityIncludeSchema.optional(),
});

export type ProjectPortabilityExport = z.infer<typeof projectPortabilityExportSchema>;

export const projectPortabilityPreviewSchema = z.object({
  source: portabilitySourceSchema,
  include: portabilityIncludeSchema.optional(),
  target: portabilityTargetSchema,
  agents: portabilityAgentSelectionSchema.optional(),
  collisionStrategy: portabilityCollisionStrategySchema.optional(),
});

export type ProjectPortabilityPreview = z.infer<typeof projectPortabilityPreviewSchema>;

export const projectPortabilityImportSchema = projectPortabilityPreviewSchema;

export type ProjectPortabilityImport = z.infer<typeof projectPortabilityImportSchema>;
