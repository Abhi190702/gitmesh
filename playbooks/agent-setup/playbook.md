---
name: gitmesh-enable-agent
description: >
  Create new agents in GitMesh Agents with governance-aware enablement. Use when you need
  to inspect adapter configuration options, compare existing agent configs,
  draft a new agent prompt/config, and submit a enablement request.
---

# GitMesh Agents Create Agent Skill

Use this skill when you are asked to enable/create an agent.

## Preconditions

You need either:

- operator access, or
- agent permission `can_create_agents=true` in your project

If you do not have this permission, escalate to your admin or maintainer.

## Workflow

1. Confirm identity and project context.

```sh
curl -sS "$GITMESH_API_URL/api/agents/me" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

2. Discover available adapter configuration docs for this GitMesh Agents instance.

```sh
curl -sS "$GITMESH_API_URL/llms/agent-configuration.txt" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

3. Read adapter-specific docs (example: `claude_local`).

```sh
curl -sS "$GITMESH_API_URL/llms/agent-configuration/claude_local.txt" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

4. Compare existing agent configurations in your project.

```sh
curl -sS "$GITMESH_API_URL/api/projects/$GITMESH_PROJECT_ID/agent-configurations" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

5. Discover allowed agent icons and pick one that matches the role.

```sh
curl -sS "$GITMESH_API_URL/llms/agent-icons.txt" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

6. Draft the new new agent config:
- role/title/name
- icon (required in practice; use one from `/llms/agent-icons.txt`)
- reporting line (`reportsTo`)
- adapter type
- adapter and runtime config aligned to this environment
- capabilities
- run prompt in adapter config (`promptTemplate` where applicable)
- source issue linkage (`sourceIssueId` or `sourceIssueIds`) when this enablement came from an issue

7. Submit enablement request.

```sh
curl -sS -X POST "$GITMESH_API_URL/api/projects/$GITMESH_PROJECT_ID/agent-enables" \
  -H "Authorization: Bearer $GITMESH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Triage",
    "role": "triage",
    "title": "Chief Technology Officer",
    "icon": "crown",
    "reportsTo": "<admin-agent-id>",
    "capabilities": "Owns technical roadmap, architecture, staffing, execution",
    "adapterType": "codex_local",
    "adapterConfig": {"cwd": "/abs/path/to/repo", "model": "o4-mini"},
    "runtimeConfig": {"heartbeat": {"enabled": true, "intervalSec": 300, "wakeOnDemand": true}},
    "sourceIssueId": "<issue-id>"
  }'
```

8. Handle governance state:
- if response has `approval`, agent is `pending_approval`
- monitor and discuss on approval thread
- when the operator approves, you will be woken with `GITMESH_APPROVAL_ID`; read linked issues and close/comment follow-up

```sh
curl -sS "$GITMESH_API_URL/api/approvals/<approval-id>" \
  -H "Authorization: Bearer $GITMESH_API_KEY"

curl -sS -X POST "$GITMESH_API_URL/api/approvals/<approval-id>/comments" \
  -H "Authorization: Bearer $GITMESH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"## agent enablement request submitted\n\n- Approval: [<approval-id>](/approvals/<approval-id>)\n- Pending agent: [<agent-ref>](/agents/<agent-url-key-or-id>)\n- Source issue: [<issue-ref>](/issues/<issue-identifier-or-id>)\n\nUpdated prompt and adapter config per operator feedback."}'
```

If the approval already exists and needs manual linking to the issue:

```sh
curl -sS -X POST "$GITMESH_API_URL/api/issues/<issue-id>/approvals" \
  -H "Authorization: Bearer $GITMESH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approvalId":"<approval-id>"}'
```

After approval is granted, run this follow-up loop:

```sh
curl -sS "$GITMESH_API_URL/api/approvals/$GITMESH_APPROVAL_ID" \
  -H "Authorization: Bearer $GITMESH_API_KEY"

curl -sS "$GITMESH_API_URL/api/approvals/$GITMESH_APPROVAL_ID/issues" \
  -H "Authorization: Bearer $GITMESH_API_KEY"
```

For each linked issue, either:
- close it if approval resolved the request, or
- comment in markdown with links to the approval and next actions.

## Quality Bar

Before sending a enablement request:

- Reuse proven config patterns from related agents where possible.
- Set a concrete `icon` from `/llms/agent-icons.txt` so the new agent is identifiable in org and task views.
- Avoid secrets in plain text unless required by adapter behavior.
- Ensure reporting line is correct and in-project.
- Ensure prompt is role-specific and operationally scoped.
- If operator requests revision, update payload and resubmit through approval flow.

For endpoint payload shapes and full examples, read:
`playbooks/agent-setup/references/api-reference.md`
