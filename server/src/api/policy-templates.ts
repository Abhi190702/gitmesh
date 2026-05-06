/**
 * Policy Templates Routes
 *
 * Operator-facing browse + install API for the starter policy library
 * shipped under `playbooks/policy-templates/`. Templates are loaded from
 * disk at startup and cached; calling `install-template` copies the
 * embedded policy bodies into the project's `agent_policies` rows.
 */
import { Router } from "express";
import type { Db } from "@gitmesh/data";
import { policyEngineService } from "../core/index.js";
import { logActivity } from "../core/index.js";
import {
  findPolicyTemplate,
  loadPolicyTemplates,
  type PolicyTemplate,
} from "../core/policy-templates-loader.js";
import { assertBoard, assertProjectAccess, getActorInfo } from "./authz.js";

export function policyTemplateRoutes(db: Db) {
  const router = Router();
  const policyEngine = policyEngineService(db);

  router.get("/policy-templates", (req, res) => {
    assertBoard(req);
    const { templates, errors } = loadPolicyTemplates();
    res.json({
      templates: templates.map(serializeTemplate),
      errors,
    });
  });

  router.get("/policy-templates/:slug", (req, res) => {
    assertBoard(req);
    const slug = (req.params.slug as string) ?? "";
    const template = findPolicyTemplate(slug);
    if (!template) {
      res.status(404).json({ error: `Policy template "${slug}" not found` });
      return;
    }
    res.json(serializeTemplate(template));
  });

  router.post("/projects/:projectId/policies/install-template", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
    const overrides =
      req.body?.overrides && typeof req.body.overrides === "object" ? req.body.overrides : null;

    if (!slug) {
      res.status(400).json({ error: "`slug` is required" });
      return;
    }

    const template = findPolicyTemplate(slug);
    if (!template) {
      res.status(404).json({ error: `Policy template "${slug}" not found` });
      return;
    }

    const actor = getActorInfo(req);
    const created: unknown[] = [];

    for (const policy of template.policies) {
      const finalName =
        overrides && typeof (overrides as { name?: unknown }).name === "string"
          ? String((overrides as { name?: unknown }).name)
          : policy.name;

      const finalPriority =
        overrides && typeof (overrides as { priority?: unknown }).priority === "number"
          ? Number((overrides as { priority?: unknown }).priority)
          : policy.priority;

      const row = await policyEngine.createPolicy(projectId, {
        name: finalName,
        description: policy.description ?? undefined,
        actionPattern: policy.actionPattern,
        conditions: policy.conditions ?? undefined,
        effect: policy.effect,
        effectConfig: policy.effectConfig ?? undefined,
        priority: finalPriority,
        createdByUserId: actor.actorId,
      });

      await logActivity(db, {
        projectId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "policy.installed_from_template",
        entityType: "agent_policy",
        entityId: row.id,
        details: {
          name: row.name,
          templateSlug: template.metadata.slug,
          source: "policy_template",
        },
      });

      created.push(row);
    }

    res.status(201).json({
      template: serializeTemplate(template),
      created,
    });
  });

  return router;
}

function serializeTemplate(template: PolicyTemplate) {
  return {
    metadata: template.metadata,
    policies: template.policies.map((p) => ({
      name: p.name,
      description: p.description,
      actionPattern: p.actionPattern,
      conditions: p.conditions,
      effect: p.effect,
      effectConfig: p.effectConfig,
      priority: p.priority,
      enabled: p.enabled,
    })),
    sourcePath: template.sourcePath,
  };
}
