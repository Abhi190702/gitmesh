import { Router } from "express";
import type { Db } from "@gitmesh/data";
import {
  SECRET_PROVIDERS,
  type SecretProvider,
  createSecretSchema,
  rotateSecretSchema,
  updateSecretSchema,
} from "@gitmesh/core";
import { validate } from "../infra/middleware/validate.js";
import { assertBoard, assertProjectAccess } from "./authz.js";
import { logActivity, secretService } from "../core/index.js";

export function secretRoutes(db: Db) {
  const router = Router();
  const svc = secretService(db);
  const configuredDefaultProvider = process.env.GITMESH_SECRETS_PROVIDER;
  const defaultProvider = (
    configuredDefaultProvider && SECRET_PROVIDERS.includes(configuredDefaultProvider as SecretProvider)
      ? configuredDefaultProvider
      : "local_encrypted"
  ) as SecretProvider;

  router.get("/projects/:projectId/secret-providers", (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    res.json(svc.listProviders());
  });

  router.get("/projects/:projectId/secrets", async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);
    const secrets = await svc.list(projectId);
    res.json(secrets);
  });

  router.post("/projects/:projectId/secrets", validate(createSecretSchema), async (req, res) => {
    assertBoard(req);
    const projectId = req.params.projectId as string;
    assertProjectAccess(req, projectId);

    const created = await svc.create(
      projectId,
      {
        name: req.body.name,
        provider: req.body.provider ?? defaultProvider,
        value: req.body.value,
        description: req.body.description,
        externalRef: req.body.externalRef,
      },
      { userId: req.actor.userId ?? "operator", agentId: null },
    );

    await logActivity(db, {
      projectId,
      actorType: "user",
      actorId: req.actor.userId ?? "operator",
      action: "secret.created",
      entityType: "secret",
      entityId: created.id,
      details: { name: created.name, provider: created.provider },
    });

    res.status(201).json(created);
  });

  router.post("/secrets/:id/rotate", validate(rotateSecretSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Secret not found" });
      return;
    }
    assertProjectAccess(req, existing.projectId);

    const rotated = await svc.rotate(
      id,
      {
        value: req.body.value,
        externalRef: req.body.externalRef,
      },
      { userId: req.actor.userId ?? "operator", agentId: null },
    );

    await logActivity(db, {
      projectId: rotated.projectId,
      actorType: "user",
      actorId: req.actor.userId ?? "operator",
      action: "secret.rotated",
      entityType: "secret",
      entityId: rotated.id,
      details: { version: rotated.latestVersion },
    });

    res.json(rotated);
  });

  router.patch("/secrets/:id", validate(updateSecretSchema), async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Secret not found" });
      return;
    }
    assertProjectAccess(req, existing.projectId);

    const updated = await svc.update(id, {
      name: req.body.name,
      description: req.body.description,
      externalRef: req.body.externalRef,
    });

    if (!updated) {
      res.status(404).json({ error: "Secret not found" });
      return;
    }

    await logActivity(db, {
      projectId: updated.projectId,
      actorType: "user",
      actorId: req.actor.userId ?? "operator",
      action: "secret.updated",
      entityType: "secret",
      entityId: updated.id,
      details: { name: updated.name },
    });

    res.json(updated);
  });

  router.delete("/secrets/:id", async (req, res) => {
    assertBoard(req);
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Secret not found" });
      return;
    }
    assertProjectAccess(req, existing.projectId);

    const removed = await svc.remove(id);
    if (!removed) {
      res.status(404).json({ error: "Secret not found" });
      return;
    }

    await logActivity(db, {
      projectId: removed.projectId,
      actorType: "user",
      actorId: req.actor.userId ?? "operator",
      action: "secret.deleted",
      entityType: "secret",
      entityId: removed.id,
      details: { name: removed.name },
    });

    res.json({ ok: true });
  });

  return router;
}
