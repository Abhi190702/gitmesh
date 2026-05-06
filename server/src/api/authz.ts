import type { Request } from "express";
import { forbidden, unauthorized } from "../errors.js";

export function assertBoard(req: Request) {
  if (req.actor.type !== "operator") {
    throw forbidden("Maintainer access required");
  }
}

export function assertProjectAccess(req: Request, projectId: string) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent" && req.actor.projectId !== projectId) {
    throw forbidden("Agent key cannot access another project");
  }
  if (req.actor.type === "operator" && req.actor.source !== "local_implicit" && !req.actor.isInstanceAdmin) {
    const allowedProjects = req.actor.projectIds ?? [];
    if (!allowedProjects.includes(projectId)) {
      throw forbidden("User does not have access to this project");
    }
  }
}

export function getActorInfo(req: Request) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
  if (req.actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: req.actor.agentId ?? "unknown-agent",
      agentId: req.actor.agentId ?? null,
      runId: req.actor.runId ?? null,
    };
  }

  return {
    actorType: "user" as const,
    actorId: req.actor.userId ?? "operator",
    agentId: null,
    runId: req.actor.runId ?? null,
  };
}
