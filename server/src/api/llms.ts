import { Router, type Request } from "express";
import type { Db } from "@gitmesh/data";
import { AGENT_ICON_NAMES } from "@gitmesh/core";
import { forbidden } from "../errors.js";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../core/agents.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function llmRoutes(db: Db) {
  const router = Router();
  const agentsSvc = agentService(db);

  async function assertCanRead(req: Request) {
    if (req.actor.type === "operator") return;
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      throw forbidden("Maintainer or permitted agent authentication required");
    }
    const actorAgent = await agentsSvc.getById(req.actor.agentId);
    if (!actorAgent || !hasCreatePermission(actorAgent)) {
      throw forbidden("Missing permission to read agent configuration reflection");
    }
  }

  router.get("/llms/agent-configuration.txt", async (req, res) => {
    await assertCanRead(req);
    const adapters = listServerAdapters().sort((a, b) => a.type.localeCompare(b.type));
    const lines = [
      "# GitMesh Agents Agent Configuration Index",
      "",
      "Installed adapters:",
      ...adapters.map((adapter) => `- ${adapter.type}: /llms/agent-configuration/${adapter.type}.txt`),
      "",
      "Related API endpoints:",
      "- GET /api/projects/:projectId/agent-configurations",
      "- GET /api/agents/:id/configuration",
      "- POST /api/projects/:projectId/agent-enables",
      "",
      "Agent identity references:",
      "- GET /llms/agent-icons.txt",
      "",
      "Notes:",
      "- Sensitive values are redacted in configuration read APIs.",
      "- New enables may be created in pending_approval state depending on project settings.",
      "",
    ];
    res.type("text/plain").send(lines.join("\n"));
  });

  router.get("/llms/agent-icons.txt", async (req, res) => {
    await assertCanRead(req);
    const lines = [
      "# GitMesh Agents Agent Icon Names",
      "",
      "Set the `icon` field on enable/create payloads to one of:",
      ...AGENT_ICON_NAMES.map((name) => `- ${name}`),
      "",
      "Example:",
      '{ "name": "SearchOps", "role": "researcher", "icon": "search" }',
      "",
    ];
    res.type("text/plain").send(lines.join("\n"));
  });

  router.get("/llms/agent-configuration/:adapterType.txt", async (req, res) => {
    await assertCanRead(req);
    const adapterType = req.params.adapterType as string;
    const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
    if (!adapter) {
      res.status(404).type("text/plain").send(`Unknown adapter type: ${adapterType}`);
      return;
    }
    res
      .type("text/plain")
      .send(
        adapter.agentConfigurationDoc ??
          `# ${adapterType} agent configuration\n\nNo adapter-specific documentation registered.`,
      );
  });

  return router;
}
