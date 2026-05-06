# Spec &mdash; Agent Configuration & Activity UI

> Three operator-facing surfaces for `/agents`: a creation dialog, a
> detailed per-agent page, and an upgraded list page. All run against
> existing backend endpoints &mdash; no new server work is required.

## What this spec covers

Agents are the workers of a GitMesh Agents project. Each one has:

- an adapter type (`claude_local`, `codex_local`, `process`, `http`) determining how it runs;
- a position in the org chart (who it reports to);
- a heartbeat policy (when and how it wakes);
- a budget.

The `/agents` UI must let operators create / configure agents, view the
hierarchy, and inspect runtime activity (run history, live logs, costs).

The three surfaces, in build order:

1. **Creation Dialog** &mdash; the "New Agent" flow.
2. **Detail Page** &mdash; configuration, activity, and logs.
3. **List Page** &mdash; quality-of-life improvements.

A single component inventory and a single API surface section close out
the spec.

---

## Surface 1 &mdash; Creation Dialog

Follows the existing `NewIssueDialog` / `NewProjectDialog` pattern: a
`Dialog` component with expand / minimise toggle, project badge
breadcrumb, and `Cmd+Enter` to submit.

### Identity (always visible)

| Field | Control | Required | Default | Notes |
|-------|---------|----------|---------|-------|
| Name | Text input (large, auto-focused) | yes | &mdash; | e.g. "Alice", "Build Bot" |
| Title | Text input (subtitle style) | no | &mdash; | e.g. "Triage Lead", "PR Reviewer" |
| Role | Chip popover (select) | no | `general` | Values from `AGENT_ROLES`: `triage`, `pr_review`, `docs`, `security`, `community`, `onboarding`, `release`, `general` |
| Reports To | Chip popover (agent select) | conditional | &mdash; | Dropdown of existing agents in the project. **First agent**: role auto-set to `triage`, Reports To greyed out. Otherwise required unless role is `triage`. |
| Capabilities | Text input | no | &mdash; | Free-text description |

### Adapter (collapsible, default open)

Common fields:

| Field | Control | Default | Notes |
|-------|---------|---------|-------|
| Adapter Type | Chip popover (select) | `claude_local` | One of `claude_local`, `codex_local`, `process`, `http` |
| Test environment | Button | &mdash; | Runs adapter-specific diagnostics; returns pass/warn/fail checks for the current unsaved config |
| CWD | Text input | &mdash; | Working directory for local adapters |
| Prompt Template | Textarea | &mdash; | Supports `{{ agent.id }}`, `{{ agent.name }}`, &hellip; |
| Model | Text input | &mdash; | Optional model override |

Adapter-specific fields toggle visibility based on Adapter Type:

| Adapter | Field | Control | Default |
|---------|-------|---------|---------|
| `claude_local` | Max Turns Per Run | Number input | `80` |
| `claude_local` | Skip Permissions | Toggle | `true` |
| `codex_local` | Search | Toggle | `false` |
| `codex_local` | Bypass Sandbox | Toggle | `true` |
| `process` | Command | Text input | &mdash; |
| `process` | Args | Text input (comma-separated) | &mdash; |
| `http` | URL | Text input | &mdash; |
| `http` | Method | Select | `POST` |
| `http` | Headers | Key-value pairs | &mdash; |

### Runtime (collapsible, default collapsed)

| Field | Control | Default |
|-------|---------|---------|
| Context Mode | Chip popover | `thin` |
| Monthly Budget (cents) | Number input | `0` |
| Timeout (sec) | Number input | `900` |
| Grace Period (sec) | Number input | `15` |
| Extra Args | Text input | &mdash; |
| Env Vars | Key-value pair editor | &mdash; |

### Heartbeat Policy (collapsible, default collapsed)

| Field | Control | Default |
|-------|---------|---------|
| Enabled | Toggle | `true` |
| Interval (sec) | Number input | `300` |
| Wake on Assignment | Toggle | `true` |
| Wake on On-Demand | Toggle | `true` |
| Wake on Automation | Toggle | `true` |
| Cooldown (sec) | Number input | `10` |

### Behaviour

- On submit, calls `agentsApi.create(projectId, data)` &mdash; identity fields go at the top level; adapter-specific fields go into `adapterConfig`; heartbeat / runtime go into `runtimeConfig`.
- After creation, navigate to the new agent's detail page.
- For the first agent in a project, pre-fill role as `triage` and disable Reports To.
- Switching adapter type updates visible fields while preserving shared values (cwd, promptTemplate, &hellip;).

---

## Surface 2 &mdash; Detail Page

Restructures the existing tabbed layout. Header stays (name, role,
title, status badge, action buttons); tabs become richer.

### Header layout

```
[StatusBadge]  Agent Name                    [Invoke] [Pause/Resume] [...]
               Role / Title
```

The `[...]` overflow menu carries: Terminate, Reset Session, Create API Key.

### Tab: Overview

Two-column layout. The left column is a Summary card; the right column
is the Org Position card.

Summary card lists:

- Adapter type + model (when set);
- Heartbeat interval (e.g. "every 5 min") or "Disabled";
- Last heartbeat time (relative, e.g. "3 min ago");
- Session status &mdash; `Active (session abc123…)` or `No session`;
- Current month spend / budget with a progress bar.

Org Position card lists:

- Reports to &mdash; clickable agent name (links to their detail page);
- Direct reports &mdash; clickable list of agents reporting to this one.

### Tab: Configuration

Editable form, same sections as the creation dialog but pre-populated.
Inline editing &mdash; click a value, edit, press Enter or blur to save via
`agentsApi.update()`. Each section is a collapsible card. Saves happen
**per field** (PATCH on blur / enter), not via a single form submit.
Validation errors render inline.

Sections:

- Identity &mdash; name, title, role, reports to, capabilities.
- Adapter Config &mdash; all adapter-specific fields for the active adapter.
- Heartbeat Policy &mdash; enable / disable, interval, wake-on triggers, cooldown.
- Runtime &mdash; context mode, budget, timeout, grace, env vars, extra args.

### Tab: Runs

The primary activity / history view. A paginated list, most recent first.

Run row layout:

```
[StatusIcon] #run-id-short   source: timer     2 min ago     1.2k tokens   $0.03
             "Reviewed 3 PRs and filed 2 issues"
```

Per-row fields:

- Status icon &mdash; green check (succeeded), red X (failed), yellow spinner (running), gray clock (queued), orange timeout, slash (cancelled).
- Run ID &mdash; first 8 chars.
- Invocation source chip &mdash; `timer` / `assignment` / `on_demand` / `automation`.
- Relative timestamp.
- Token usage summary (input + output total).
- Cost.
- Result summary &mdash; first line of the result (or error).

Clicking a run opens an inline accordion (or a slide-over panel) with:

- Full status timeline `queued -> running -> outcome` with timestamps.
- Session before / after.
- Token breakdown: input, output, cached input.
- Cost breakdown.
- Error message and error code (when failed).
- Exit code and signal (where applicable).

The run detail also embeds the **Log Viewer**:

- Streams `heartbeat_run_events` for the run, ordered by `seq`.
- Each event renders as a log line: timestamp, colour-coded level, message.
- Events of type `stdout` / `stderr` render in monospace.
- System events get distinct styling.
- For running runs, auto-scroll and live-append via WebSocket events `heartbeat.run.event` and `heartbeat.run.log`.
- "View full log" link fetches `heartbeatsApi.log(runId)` and shows it in a scrollable monospace container.
- Truncation: show the last 200 events by default; "Load more" fetches earlier events.

### Tab: Issues

Unchanged. Lists issues assigned to this agent with status; clickable
to issue detail.

### Tab: Costs

Expand the existing costs tab:

- Cumulative totals from `agent_runtime_state` &mdash; total input tokens, total output tokens, total cached tokens, total cost.
- Monthly budget progress bar (current-month spend vs. budget).
- Per-run cost table &mdash; date, run id, tokens in / out / cached, cost. Sortable by date or cost.
- Stretch: a simple bar chart of daily spend over the last 30 days.

### Right sidebar &mdash; Properties Panel

Existing `AgentProperties` panel continues with quick-glance info. Add:

- Session ID (truncated, with copy button).
- Last error (red, when present).
- Link to "View Configuration" (scrolls / switches to the Configuration tab).

---

## Surface 3 &mdash; List Page

### Today

A flat list of agents: status badge, name, role, title, budget bar.

### Changes

- Add a "New Agent" button in the header (Plus icon + label) that opens the creation dialog.
- Add a view toggle: List view (current) vs. Org Chart view.

#### Org Chart view

- Tree layout reflecting the reporting hierarchy.
- Each node shows agent name, role, status badge.
- Admin agent at the top, direct reports below.
- Backed by `agentsApi.org(projectId)`, which already returns `OrgNode[]`.
- Clicking a node navigates to that agent's detail page.

#### List view enhancements

- Adapter type as a small chip / tag on each row.
- "Last active" relative timestamp.
- Running indicator (animated dot) when the agent currently has a running heartbeat.

#### Filtering

Tab filters: `All`, `Active`, `Paused`, `Error`. Same pattern as the
Issues page.

---

## Component inventory

New components needed:

| Component | Purpose |
|-----------|---------|
| `NewAgentDialog` | Agent creation form dialog |
| `AgentConfigForm` | Shared form sections for create + edit (adapter, heartbeat, runtime) |
| `AdapterConfigFields` | Conditional fields based on adapter type |
| `HeartbeatPolicyFields` | Heartbeat configuration fields |
| `EnvVarEditor` | Key-value pair editor for env vars |
| `RunListItem` | Single run row in the runs list |
| `RunDetail` | Expanded run detail with log viewer |
| `LogViewer` | Streaming log viewer with auto-scroll |
| `OrgChart` | Tree visualisation of the agent hierarchy |
| `AgentSelect` | Reusable agent picker (Reports To, etc.) |

Reused (existing): `StatusBadge`, `EntityRow`, `EmptyState`,
`PropertyRow`. From shadcn: `Dialog`, `Tabs`, `Button`, `Popover`,
`Command`, `Separator`, `Toggle`.

---

## API surface

All endpoints already exist. No new server work needed for V1.

| Action | Endpoint | Used by |
|--------|----------|---------|
| List agents | `GET /projects/:id/agents` | List page |
| Get org tree | `GET /projects/:id/org` | Org chart view |
| Create agent | `POST /projects/:id/agents` | Creation dialog |
| Update agent | `PATCH /agents/:id` | Configuration tab |
| Pause / Resume / Terminate | `POST /agents/:id/{action}` | Header actions |
| Reset session | `POST /agents/:id/runtime-state/reset-session` | Overflow menu |
| Create API key | `POST /agents/:id/keys` | Overflow menu |
| Get runtime state | `GET /agents/:id/runtime-state` | Overview tab + properties panel |
| Invoke / Wakeup | `POST /agents/:id/heartbeat/invoke` | Header invoke button |
| List runs | `GET /projects/:id/heartbeat-runs?agentId=X` | Runs tab |
| Cancel run | `POST /heartbeat-runs/:id/cancel` | Run detail |
| Run events | `GET /heartbeat-runs/:id/events` | Log viewer |
| Run log | `GET /heartbeat-runs/:id/log` | Full log view |

---

## Implementation order

The first five steps are the core; the rest are polish.

1. **New Agent Dialog** &mdash; unblocks UI-driven agent creation.
2. **Agents List improvements** &mdash; New Agent button, tab filters, adapter chip, running indicator.
3. **Agent Detail: Configuration tab** &mdash; editable adapter / heartbeat / runtime config.
4. **Agent Detail: Runs tab** &mdash; run history list with status, tokens, cost.
5. **Agent Detail: Run Detail + Log Viewer** &mdash; expandable run detail with streaming logs.
6. **Agent Detail: Overview tab** &mdash; summary card + org position.
7. **Agent Detail: Costs tab** &mdash; expanded cost breakdown.
8. **Org Chart view** &mdash; tree visualisation on the list page.
9. **Properties panel updates** &mdash; session ID + last error.
