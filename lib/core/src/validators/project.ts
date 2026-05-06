import { z } from "zod";
import { PROJECT_ORG_STATUSES } from "../constants.js";

const FORGE_PROVIDERS = ["github", "gitlab", "forgejo"] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  budgetMonthlyCents: z.number().int().nonnegative().optional().default(0),
  /** URL of the repository this project tracks */
  repoUrl: z.string().url().optional().nullable(),
  /** Forge provider type */
  forgeProvider: z.enum(FORGE_PROVIDERS).optional().nullable(),
  /** Owner / org on the forge */
  forgeOwner: z.string().min(1).optional().nullable(),
  /** Repository name on the forge */
  forgeRepo: z.string().min(1).optional().nullable(),
});

export type CreateProject = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    status: z.enum(PROJECT_ORG_STATUSES).optional(),
    spentMonthlyCents: z.number().int().nonnegative().optional(),
    requireOperatorApprovalForNewAgents: z.boolean().optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  });

export type UpdateProject = z.infer<typeof updateProjectSchema>;
