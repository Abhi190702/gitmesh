> Historical plan. Superseded by IMPLEMENTATION.md for GitMesh Agents context.

# Agent Authentication & Onboarding

## Problem

Agents need API keys to authenticate with GitMesh Agents. The current approach
(generate key in app, manually configure it as an environment variable) is
laborious and doesn't scale. Different adapter types have different trust
models, and we want to support a spectrum from "zero-config local" to
"agent-driven self-registration."

## Design Principles

1. **Match auth complexity to the trust boundary.** A local CLI adapter
   shouldn't require the same ceremony as a remote webhook-based agent.
2. **Agents should be able to onboard themselves.** Humans shouldn't have to
   copy-paste credentials into agent environments when the agent is capable of
   doing it.
3. **Approval gates by default.** Self-registration must require explicit
   approval (by a user or authorized agent) before the new agent can act within
   a project.

---

## Authentication Tiers

### Tier 1: Local Adapter (claude-local, codex-local)

**Trust model:** The adapter process runs on the same machine as the GitMesh Agents
server (or is invoked directly by it). There is no meaningful network boundary.

**Approach:** GitMesh Agents generates a token and passes it directly to the agent
process as a parameter/env var at invocation time. No manual setup required.

**Token format:** Short-lived JWT issued per heartbeat invocation (or per
session). The server mints the token, passes it in the adapter call, and
accepts it back on API requests.

**Token lifetime considerations:**

- Coding agents can run for hours, so tokens can't expire too quickly.
- Infinite-lived tokens are undesirable even in local contexts.
- Use JWTs with a generous expiry (e.g. 48h) and overlap windows so a
  heartbeat that starts near expiry still completes.
- The server doesn't need to store these tokens -- it just validates the JWT
  signature.

**Status:** Partially implemented. The local adapter already passes
`GITMESH_API_URL`, `GITMESH_AGENT_ID`, `GITMESH_COMPANY_ID`. We need to
add a `GITMESH_API_KEY` (JWT) to the set of injected env vars.

### Tier 2: CLI-Driven Key Exchange

**Trust model:** A developer is setting up a remote or semi-remote agent and
has shell access to it.

**Approach:** Similar to `claude setup-token` -- the developer runs a GitMesh Agents CLI
command that opens a browser URL for confirmation, then receives a token that
gets stored in the agent's config automatically.

```
gitmesh-agents auth login
# Opens browser -> user confirms -> token stored at ~/.gitmesh-agents/credentials
```

**Token format:** Long-lived API key (stored hashed on the server side).

**Status:** Future. Not needed until we have remote adapters that aren't
managed by the GitMesh Agents server itself.

### Tier 3: Agent Self-Registration (Invite Link)

**Trust model:** The agent is an autonomous external system (e.g. an Gateway
agent, a SWE-agent instance). There is no human in the loop during setup. The
agent receives an onboarding URL and negotiates its own registration.

**Approach:**

1. A project admin (user or agent) generates an **invite URL** from GitMesh Agents.
2. The invite URL is delivered to the target agent (via a message, a task
   description, a webhook payload, etc.).
3. The agent fetches the URL, which returns an **onboarding document**
   containing:
   - Project identity and context
   - The GitMesh Agents playbook.md (or a link to it)
   - What information GitMesh Agents needs from the agent (e.g. webhook URL, adapter
     type, capabilities, preferred name/role)
   - A registration endpoint to POST the response to
4. The agent responds with its configuration (e.g. "here's my webhook URL,
   here's my name, here are my capabilities").
5. GitMesh Agents stores the pending registration.
6. An approver (user or authorized agent) reviews and approves the new
   employee. Approval includes assigning the agent's manager (chain of command)
   and any initial role/permissions.
7. On approval, GitMesh Agents provisions the agent's credentials and sends the
   first heartbeat.

**Token format:** GitMesh Agents issues an API key (or JWT) upon approval, delivered
to the agent via its declared communication channel.

**Inspiration:**

- [Allium self-registration](https://agents.allium.so/skills/skill.md) --
  agent collects credentials, polls for confirmation, stores key automatically.
- [Allium x402](https://agents.allium.so/skills/x402-skill.md) -- multi-step
  credential setup driven entirely by the agent.
- [Gateway webhooks](https://docs.gateway.ai/automation/webhook) -- external
  systems trigger agent actions via authenticated webhook endpoints.

---

## Self-Registration: Onboarding Negotiation Protocol

The invite URL response should be a structured document (JSON or markdown) that
is both human-readable and machine-parseable:

```
GET /api/invite/{inviteToken}
```

Response:

```json
{
  "project": {
    "id": "...",
    "name": "Acme Corp"
  },
  "onboarding": {
    "instructions": "You are being invited to join Acme Corp as an employee agent...",
    "skillUrl": "https://app.gitmesh-agents.ing/playbooks/gitmesh-agents/playbook.md",
    "requiredFields": {
      "name": "Your display name",
      "adapterType": "How GitMesh Agents should send you heartbeats",
      "webhookUrl": "If adapter is webhook-based, your endpoint URL",
      "capabilities": "What you can do (free text or structured)"
    },
    "registrationEndpoint": "POST /api/invite/{inviteToken}/register"
  }
}
```

The agent POSTs back:

```json
{
  "name": "CodingBot",
  "adapterType": "webhook",
  "webhookUrl": "https://my-agent.example.com/hooks/agent",
  "webhookAuthToken": "Bearer ...",
  "capabilities": ["code-review", "implementation", "testing"]
}
```

This goes into a `pending_approval` state until someone approves it.

---

## Gateway as First External Integration

Gateway is the ideal first target for Tier 3 because:

- It already has webhook support (`POST /hooks/agent`) for receiving tasks.
- The webhook config (URL, auth token, session key) is exactly what we need the
  agent to tell us during onboarding.
- gateway agents can read a URL, parse instructions, and make HTTP calls.

**Workflow:**

1. Generate a GitMesh Agents invite link for the project.
2. Send the invite link to an gateway agent (via their existing messaging
   channel).
3. The gateway agent fetches the invite, reads the onboarding doc, and
   responds with its webhook configuration.
4. A GitMesh Agents project member approves the new agent.
5. GitMesh Agents begins sending heartbeats to the Gateway webhook endpoint.

---

## Approval Model

All self-registration requires approval. This is non-negotiable for security.

- **Default:** A human user in the project must approve.
- **Delegated:** A manager-level agent with `approve_agents` permission can
  approve (useful for scaling).
- **Auto-approve (opt-in):** Projects can configure auto-approval for invite
  links that were generated with a specific trust level (e.g. "I trust anyone
  with this link"). Even then, the invite link itself is a secret.

On approval, the approver sets:

- `reportsTo` -- who the new agent reports to in the chain of command
- `role` -- the agent's role within the project
- `budget` -- initial budget allocation

---

## Implementation Priorities

| Priority | Item                              | Notes                                                                                            |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **P0**   | Local adapter JWT injection       | Unblocks zero-config local auth. Mint a JWT per heartbeat, pass as `GITMESH_API_KEY`.          |
| **P1**   | Invite link + onboarding endpoint | `POST /api/projects/:id/invites`, `GET /api/invite/:token`, `POST /api/invite/:token/register`. |
| **P1**   | Approval flow                     | UI + API for reviewing and approving pending agent registrations.                                |
| **P2**   | Gateway integration              | First real external agent onboarding via invite link.                                            |
| **P3**   | CLI auth flow                     | `gitmesh-agents auth login` for developer-managed remote agents.                                      |

## P0 Implementation Plan

See [`doc/plans/agent-authentication-implementation.md`](./agent-authentication-implementation.md) for the P0 local JWT execution plan.

---

## Open Questions

- **JWT signing key rotation:** How do we rotate the signing key without
  invalidating in-flight heartbeats?
- **Invite link expiry:** Should invite links be single-use or multi-use? Time-limited?
- **Adapter negotiation:** Should the onboarding doc support arbitrary adapter
  types, or should we enumerate supported adapters and have the agent pick one?
- **Credential renewal:** For long-lived external agents, how do we handle API
  key rotation without downtime?
