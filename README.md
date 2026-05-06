# GitMesh

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-LF--Decentralized--Trust--labs%2Fgitmesh-181717?logo=github)](https://github.com/LF-Decentralized-Trust-labs/gitmesh)

**GitMesh is a self-hosted platform for running multiple AI agents across your open-source project.** It provides policy-as-code governance so agents can work autonomously within defined boundaries — labeling issues, reviewing PRs, managing releases — while requiring human approval for sensitive actions like merging code or publishing security advisories.

---

## What Problem Does It Solve?

Running multiple AI agents on a project without governance leads to:
- Agents merging code without review
- Conflicting agents overwriting each other's work
- No audit trail for agent decisions
- Budget overruns from unbounded agent usage
- Security vulnerabilities from agents accessing unauthorized resources

GitMesh addresses this by providing:
- **Policy engine** that evaluates every agent action before execution
- **Atomic issue checkout** preventing concurrent agent work
- **Full activity audit trail** with policy metadata
- **Budget caps** with automatic pausing
- **Role-based permissions** limiting agents to their domain

---

## Quickstart

### Prerequisites

- **Node.js 20+**
- **pnpm 9+** (the setup script can install it via Corepack if missing)
- **Docker** — optional; only required if you use Docker for PostgreSQL instead of the embedded database

### One-command setup (macOS / Linux / Windows)

From the repo root:

| Platform | Command |
| -------- | ------- |
| macOS / Linux | `./setup.sh` |
| Windows (PowerShell) | `./setup.ps1` |
| Windows (cmd) | `setup.cmd` |

These wrappers run `scripts/setup.mjs`, which checks Node, ensures pnpm, copies `.env.example` → `.env` when missing, installs dependencies, and builds the workspace.

Useful flags (all platforms):

```bash
node scripts/setup.mjs --start          # install + build + pnpm dev
node scripts/setup.mjs --with-docker-db # also start Docker Compose Postgres on localhost:5433
```

### Manual setup

```bash
git clone https://github.com/LF-Decentralized-Trust-labs/gitmesh.git
cd gitmesh
pnpm install --no-frozen-lockfile   # first clone; CI uses frozen lockfile
pnpm dev                            # API + UI — see below
```

### Database (embedded vs external)

GitMesh uses **PostgreSQL** (via Drizzle). For local development you have two common paths:

**1. Embedded PostgreSQL (default, no extra install)**  

- **Do not set** `DATABASE_URL` (leave it unset, or keep it commented out in `.env`).
- The dev server starts an **embedded** PostgreSQL instance and stores data under  
  `~/.gitmesh-agents/instances/default/db/` (overridable with `GITMESH_HOME` / `GITMESH_INSTANCE_ID`).
- This works for **most** developers on a normal machine with disk space and a writable home directory.
- It is **not universal**: unusual environments (strict permissions, missing native binaries for your OS/arch, incomplete installs) may fail. In those cases use path **2**.

**2. External PostgreSQL (`DATABASE_URL`)**  

- Set `DATABASE_URL` to a real server (local Docker, cloud, etc.).
- Apply migrations when needed:  
  `DATABASE_URL='postgres://...' pnpm db:migrate`  
  (same connection string the app uses).
- If you copy `.env.example` to `.env` and **uncomment** a URL such as  
  `postgres://gitmesh:gitmesh@localhost:5433/gitmesh`, you must **run Postgres on that host and port** first (for example `pnpm db:up`, or `node scripts/setup.mjs --with-docker-db`). Otherwise the app will fail to connect (for example `ECONNREFUSED` on port 5433).

Authoritative detail: **`doc/DEVELOPING.md`**, **`doc/DATABASE.md`**.

### Start the platform

```bash
pnpm dev
```

In development, the **API and the maintainer UI share one origin**:

- **http://localhost:3100** — REST API (`/api/...`) and UI

For a single run without file watching:

```bash
pnpm dev:once
```

Optional: `pnpm gitmesh-agents run` — onboarding, `doctor --repair`, and start when checks pass.

### Docker images

- **`Dockerfile`** — production-style image; persistent state under `GITMESH_HOME` (volume `/gitmesh-agents`), embedded PostgreSQL by default in typical deployments. See **`doc/DOCKER.md`**.
- **`Dockerfile.e2e`** — installs/runs `gitmesh-agents` from npm for E2E-style bootstrap inside a container.

---

## Creating Your First Agent

### 1. Create a Project

After starting the server, open **http://localhost:3100** and create a new project for your repository.

### 2. Configure an Agent

In your project's settings, create an agent:

```yaml
name: Issue Triage
role: triage
schedule: "0 * * * *"  # Every hour
budget: 5000            # 5000 tokens/month
```

Available roles:
- `triage` — Labels, prioritizes, routes issues
- `pr_review` — Reviews PRs for style and policy compliance
- `docs` — Detects undocumented code, drafts doc PRs
- `security` — Monitors CVEs, scans for secrets
- `community` — Responds to issues and discussions
- `onboarding` — Welcomes first-time contributors
- `release` — Generates changelogs, manages releases

### 3. Configure Policies

Add policies to govern agent behavior:

```yaml
policies:
  - name: Require approval for merge
    actionPattern: merge_pr
    effect: require_approval

  - name: Block direct push to main
    actionPattern: push
    conditions:
      targetBranch: [main, master]
    effect: block
```

---

## Architecture

### Monorepo Structure

| Package | Description |
|---------|-------------|
| `server` | API server with orchestration runtime |
| `ui` | React dashboard for project management |
| `cli` | Operator CLI (`gitmesh-agents`) |
| `lib/core` | Shared constants, types, validators |
| `lib/data` | Drizzle ORM schema and migrations |
| `lib/adapter-sdk` | SDK for building agent adapters |
| `lib/adapters/*` | Adapter implementations (Claude, Codex, Cursor, etc.) |

### How Agents Execute

```
Webhook or Schedule Trigger
        │
        ▼
  ┌─────────────┐
  │  Forge Sync  │  ← Validates and enriches event data
  └──────┬───────┘
         │
         ▼
  ┌─────────────┐
  │Policy Engine │  ← Evaluates YAML policies
  └──────┬───────┘
         │
    allow │ block │ require_approval
         │
         ▼
  ┌─────────────┐
  │  Heartbeat   │  ← Runs agent adapter
  └──────┬───────┘
         │
         ▼
  ┌─────────────┐
  │ Activity Log │  ← Records full audit trail
  └─────────────┘
```

---

## Configuration

See **`.env.example`** for a full template. Highlights:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | When set, uses that PostgreSQL server; when unset, embedded PostgreSQL is used (see [Database](#database-embedded-vs-external) above). |
| `PORT` | HTTP port (often `3100`). |

Deployment mode, auth, and GitHub integration are documented in **`.env.example`** and **`doc/DEVELOPING.md`**.

---

## Development

```bash
# Type check all packages
pnpm -r typecheck

# Run tests
pnpm test:run

# Build for production
pnpm build

# Start only the API server
pnpm dev:server

# Start only the UI (Vite)
pnpm dev:ui
```

Full contributor workflow: **`doc/DEVELOPING.md`**, **`AGENTS.md`**.

---

## Documentation & contributing

| Resource | Purpose |
| -------- | ------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Pull requests, review expectations, CI checks |
| [doc/GOAL.md](doc/GOAL.md), [doc/vision.md](doc/vision.md) | Product direction |
| [doc/v1-spec.md](doc/v1-spec.md) | V1 implementation contract (authoritative when it conflicts with broader arch docs) |
| [doc/DEVELOPING.md](doc/DEVELOPING.md), [doc/DATABASE.md](doc/DATABASE.md) | Local dev, DB, embedded PostgreSQL |
| [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | Contributor guides (humans & AI tooling) |

**Community:** [Issues](https://github.com/LF-Decentralized-Trust-labs/gitmesh/issues) · [Discussions](https://github.com/LF-Decentralized-Trust-labs/gitmesh/discussions)

---

## Maintainers

<table width="100%">
  <tr align="center">
    <td valign="top" width="50%">
      <a href="https://github.com/parvm1102" target="_blank" rel="noopener noreferrer">
        <img src="https://avatars.githubusercontent.com/parvm1102?s=150" width="120" alt="parvm1102"/><br/>
        <strong>parvm1102</strong>
      </a>
      <p>
        <a href="https://github.com/parvm1102" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white" alt="GitHub"/>
        </a>
        <a href="https://linkedin.com/in/mittal-parv" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/>
        </a>
        <a href="mailto:mittal@gitmesh.dev">
          <img src="https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white" alt="Email"/>
        </a>
      </p>
    </td>
    <td valign="top" width="50%">
      <a href="https://github.com/Ronit-Raj9" target="_blank" rel="noopener noreferrer">
        <img src="https://avatars.githubusercontent.com/Ronit-Raj9?s=150" width="120" alt="Ronit-Raj9"/><br/>
        <strong>Ronit-Raj9</strong>
      </a>
      <p>
        <a href="https://github.com/Ronit-Raj9" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white" alt="GitHub"/>
        </a>
        <a href="https://www.linkedin.com/in/ronitraj-ai" target="_blank" rel="noopener noreferrer">
          <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/>
        </a>
        <a href="mailto:ronii@gitmesh.dev">
          <img src="https://img.shields.io/badge/Email-D14836?style=flat&logo=gmail&logoColor=white" alt="Email"/>
        </a>
      </p>
    </td>
  </tr>
</table>

## License

Apache-2.0 — © 2026 LF Decentralized Trust
