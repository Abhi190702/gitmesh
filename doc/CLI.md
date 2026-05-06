# CLI Reference

GitMesh Agents CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm gitmesh-agents --help
```

First-time local bootstrap + run:

```sh
pnpm gitmesh-agents run
```

Choose local instance:

```sh
pnpm gitmesh-agents run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `gitmesh-agents onboard` and `gitmesh-agents configure --section server` set deployment mode in config
- runtime can override mode with `GITMESH_DEPLOYMENT_MODE`
- `gitmesh-agents run` and `gitmesh-agents doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm gitmesh-agents allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Project-scoped commands also support `--project-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.gitmesh-agents`:

```sh
pnpm gitmesh-agents run --data-dir ./tmp/gitmesh-agents-dev
pnpm gitmesh-agents issue list --data-dir ./tmp/gitmesh-agents-dev
```

## Context Profiles

Store local defaults in `~/.gitmesh-agents/context.json`:

```sh
pnpm gitmesh-agents context set --api-base http://localhost:3100 --project-id <project-id>
pnpm gitmesh-agents context show
pnpm gitmesh-agents context list
pnpm gitmesh-agents context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm gitmesh-agents context set --api-key-env-var-name GITMESH_API_KEY
export GITMESH_API_KEY=...
```

## Project Commands

```sh
pnpm gitmesh-agents project list
pnpm gitmesh-agents project get <project-id>
pnpm gitmesh-agents project delete <project-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm gitmesh-agents project delete PAP --yes --confirm PAP
pnpm gitmesh-agents project delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `GITMESH_ENABLE_PROJECT_DELETION`.
- With agent authentication, project deletion is project-scoped. Use the current project ID/prefix (for example via `--project-id` or `GITMESH_PROJECT_ID`), not another project.

## Issue Commands

```sh
pnpm gitmesh-agents issue list --project-id <project-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm gitmesh-agents issue get <issue-id-or-identifier>
pnpm gitmesh-agents issue create --project-id <project-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm gitmesh-agents issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm gitmesh-agents issue comment <issue-id> --body "..." [--reopen]
pnpm gitmesh-agents issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm gitmesh-agents issue release <issue-id>
```

## Agent Commands

```sh
pnpm gitmesh-agents agent list --project-id <project-id>
pnpm gitmesh-agents agent get <agent-id>
pnpm gitmesh-agents agent local-cli <agent-id-or-shortname> --project-id <project-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a GitMesh Agents agent:

- creates a new long-lived agent API key
- installs missing GitMesh Agents playbooks into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `GITMESH_API_URL`, `GITMESH_PROJECT_ID`, `GITMESH_AGENT_ID`, and `GITMESH_API_KEY`

Example for shortname-based local setup:

```sh
pnpm gitmesh-agents agent local-cli codexcoder --project-id <project-id>
pnpm gitmesh-agents agent local-cli claudecoder --project-id <project-id>
```

## Approval Commands

```sh
pnpm gitmesh-agents approval list --project-id <project-id> [--status pending]
pnpm gitmesh-agents approval get <approval-id>
pnpm gitmesh-agents approval create --project-id <project-id> --type enable_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm gitmesh-agents approval approve <approval-id> [--decision-note "..."]
pnpm gitmesh-agents approval reject <approval-id> [--decision-note "..."]
pnpm gitmesh-agents approval request-revision <approval-id> [--decision-note "..."]
pnpm gitmesh-agents approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm gitmesh-agents approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm gitmesh-agents activity list --project-id <project-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm gitmesh-agents dashboard get --project-id <project-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm gitmesh-agents heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.gitmesh-agents/instances/default`:

- config: `~/.gitmesh-agents/instances/default/config.json`
- embedded db: `~/.gitmesh-agents/instances/default/db`
- logs: `~/.gitmesh-agents/instances/default/logs`
- storage: `~/.gitmesh-agents/instances/default/data/storage`
- secrets key: `~/.gitmesh-agents/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
GITMESH_HOME=/custom/home GITMESH_INSTANCE_ID=dev pnpm gitmesh-agents run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm gitmesh-agents configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
