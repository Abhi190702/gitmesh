/**
 * Policy Routes
 *
 * API endpoints for managing agent governance policies within a project.
 * Includes CRUD operations and policy evaluation endpoints.
 */

import { Router } from "express";
import type { Db } from "@gitmesh/data";
import { policyEngineService } from "../core/index.js";
import { assertBoard, assertProjectAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../core/index.js";
import { compilePoliciesFromYAML } from "../core/policy-compiler.js";

export function policyRoutes(db: Db) {
  const router = Router();
  const policyEngine = policyEngineService(db);

  /**
   * GET /api/projects/:projectId/policies
   * List all policies for a project.
   */
  router.get("/:projectId/policies", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const policies = await policyEngine.listPolicies(projectId);
    res.json(policies);
  });

  /**
   * GET /api/projects/:projectId/policies/:policyId
   * Get a single policy.
   */
  router.get("/:projectId/policies/:policyId", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const policy = await policyEngine.getPolicy(req.params.policyId);
    if (!policy) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }
    res.json(policy);
  });

  /**
   * POST /api/projects/:projectId/policies
   * Create a new policy.
   */
  router.post("/:projectId/policies", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const actor = getActorInfo(req);
    const policy = await policyEngine.createPolicy(projectId, {
      ...req.body,
      createdByUserId: actor.actorId,
    });

    await logActivity(db, {
      projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "policy.created",
      entityType: "agent_policy",
      entityId: policy.id,
      details: { name: policy.name, actionPattern: policy.actionPattern, effect: policy.effect },
    });

    res.status(201).json(policy);
  });

  /**
   * PATCH /api/projects/:projectId/policies/:policyId
   * Update a policy (creates a new version).
   */
  router.patch("/:projectId/policies/:policyId", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const policy = await policyEngine.updatePolicy(req.params.policyId, req.body);
    if (!policy) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "policy.updated",
      entityType: "agent_policy",
      entityId: policy.id,
      details: { name: policy.name, version: policy.version },
    });

    res.json(policy);
  });

  /**
   * DELETE /api/projects/:projectId/policies/:policyId
   * Delete a policy.
   */
  router.delete("/:projectId/policies/:policyId", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const deleted = await policyEngine.deletePolicy(req.params.policyId);
    if (!deleted) {
      res.status(404).json({ error: "Policy not found" });
      return;
    }

    const actor = getActorInfo(req);
    await logActivity(db, {
      projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "policy.deleted",
      entityType: "agent_policy",
      entityId: deleted.id,
      details: { name: deleted.name },
    });

    res.json({ ok: true });
  });

  /**
   * POST /api/projects/:projectId/policies/initialize
   * Initialize default policies for a project.
   */
  router.post("/:projectId/policies/initialize", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const actor = getActorInfo(req);
    await policyEngine.initializeDefaults(projectId, actor.actorId);

    await logActivity(db, {
      projectId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "policy.defaults_initialized",
      entityType: "project",
      entityId: projectId,
    });

    const policies = await policyEngine.listPolicies(projectId);
    res.json(policies);
  });

  /**
   * POST /api/projects/:projectId/policies/evaluate
   * Evaluate an action against the project's policies (dry-run).
   * Useful for testing policy configurations.
   */
  router.post("/:projectId/policies/evaluate", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const { agentId, action, context } = req.body;
    if (!agentId || !action) {
      res.status(400).json({ error: "agentId and action are required" });
      return;
    }

    const result = await policyEngine.evaluate({
      projectId,
      agentId,
      action,
      context,
    });

    res.json(result);
  });

  /**
   * POST /api/projects/:projectId/policies/compile-yaml
   * Compile YAML policy definitions.
   */
  router.post("/:projectId/policies/compile-yaml", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const { yaml } = req.body;
    if (typeof yaml !== "string") {
      res.status(400).json({ error: "'yaml' field must be a string" });
      return;
    }

    const { policies, errors } = compilePoliciesFromYAML(yaml);

    if (errors.length > 0) {
      res.status(400).json({ error: "YAML compilation failed", errors, successCount: policies.length });
      return;
    }

    res.json({ policies, count: policies.length, message: `Successfully compiled ${policies.length} policy(ies)` });
  });

  /**
   * POST /api/projects/:projectId/policies/import-yaml
   * Import YAML policies and create them.
   */
  router.post("/:projectId/policies/import-yaml", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const { yaml } = req.body;
    if (typeof yaml !== "string") {
      res.status(400).json({ error: "'yaml' field must be a string" });
      return;
    }

    const { policies: compiledPolicies, errors } = compilePoliciesFromYAML(yaml);
    const actor = getActorInfo(req);
    const createdPolicies = [];

    for (const compiled of compiledPolicies) {
      const created = await policyEngine.createPolicy(projectId, {
        name: compiled.name,
        description: compiled.description ?? undefined,
        actionPattern: compiled.actionPattern,
        conditions: compiled.conditions ?? undefined,
        effect: compiled.effect,
        effectConfig: compiled.effectConfig ?? undefined,
        priority: compiled.priority,
        createdByUserId: actor.actorId,
      });

      await logActivity(db, {
        projectId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "policy.imported_from_yaml",
        entityType: "agent_policy",
        entityId: created.id,
        details: { name: created.name, source: "yaml_import" },
      });

      createdPolicies.push(created);
    }

    res.json({ created: createdPolicies, errors, summary: { createdCount: createdPolicies.length, errorCount: errors.length } });
  });

  return router;
}
