import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, ne } from "@gitmesh/data";
import type { Db } from "@gitmesh/data";
import {
  agents,
  agentConfigRevisions,
  agentApiKeys,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  heartbeatRunEvents,
  heartbeatRuns,
} from "@gitmesh/data";
import { isUuidLike, normalizeAgentUrlKey } from "@gitmesh/core";
import { conflict, notFound, unprocessable } from "../errors.js";
import { normalizeAgentPermissions } from "./agent-permissions.js";
import { REDACTED_EVENT_VALUE, sanitizeRecord } from "../redaction.js";

// ── Token utilities ────────────────────────────────────────────────────────

function deriveTokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateToken(): string {
  return `gmesh_${randomBytes(24).toString("hex")}`;
}

// ── Config revision types ──────────────────────────────────────────────────

const TRACKED_FIELDS = [
  "name",
  "role",
  "title",
  "reportsTo",
  "capabilities",
  "adapterType",
  "adapterConfig",
  "runtimeConfig",
  "budgetMonthlyCents",
  "metadata",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];
type ConfigSnapshot = Pick<typeof agents.$inferSelect, TrackedField>;

interface RevisionMeta {
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
  source?: string;
  rolledBackFromRevisionId?: string | null;
}

interface UpdateOptions {
  recordRevision?: RevisionMeta;
}

interface ShortnameCandidate {
  id: string;
  name: string;
  status: string;
}

interface ShortnameOptions {
  excludeAgentId?: string | null;
}

// ── Serialization helpers ──────────────────────────────────────────────────

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeRecord(value: unknown): Record<string, unknown> {
  if (!isRecordLike(value)) return {};
  return sanitizeRecord(value);
}

function captureSnapshot(
  row: Pick<typeof agents.$inferSelect, TrackedField>,
): ConfigSnapshot {
  return {
    name: row.name,
    role: row.role,
    title: row.title,
    reportsTo: row.reportsTo,
    capabilities: row.capabilities,
    adapterType: row.adapterType,
    adapterConfig: serializeRecord(row.adapterConfig),
    runtimeConfig: serializeRecord(row.runtimeConfig),
    budgetMonthlyCents: row.budgetMonthlyCents,
    metadata: isRecordLike(row.metadata) ? serializeRecord(row.metadata) : (row.metadata ?? null),
  };
}

function hasPatchFields(data: Partial<typeof agents.$inferInsert>): boolean {
  return TRACKED_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function changedFields(before: ConfigSnapshot, after: ConfigSnapshot): string[] {
  return TRACKED_FIELDS.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]));
}

function patchFromSnapshot(snapshot: unknown): Partial<typeof agents.$inferInsert> {
  if (!isRecordLike(snapshot)) throw unprocessable("Invalid revision snapshot");

  const s = snapshot as Record<string, unknown>;

  if (typeof s.name !== "string" || s.name.length === 0) throw unprocessable("Invalid revision snapshot: name");
  if (typeof s.role !== "string" || s.role.length === 0) throw unprocessable("Invalid revision snapshot: role");
  if (typeof s.adapterType !== "string" || s.adapterType.length === 0) throw unprocessable("Invalid revision snapshot: adapterType");
  if (typeof s.budgetMonthlyCents !== "number" || !Number.isFinite(s.budgetMonthlyCents)) {
    throw unprocessable("Invalid revision snapshot: budgetMonthlyCents");
  }

  return {
    name: s.name,
    role: s.role,
    title: typeof s.title === "string" || s.title === null ? s.title : null,
    reportsTo: typeof s.reportsTo === "string" || s.reportsTo === null ? s.reportsTo : null,
    capabilities: typeof s.capabilities === "string" || s.capabilities === null ? s.capabilities : null,
    adapterType: s.adapterType,
    adapterConfig: isRecordLike(s.adapterConfig) ? s.adapterConfig : {},
    runtimeConfig: isRecordLike(s.runtimeConfig) ? s.runtimeConfig : {},
    budgetMonthlyCents: Math.max(0, Math.floor(Number(s.budgetMonthlyCents))),
    metadata: isRecordLike(s.metadata) || s.metadata === null ? s.metadata : null,
  };
}

function containsRedacted(value: unknown): boolean {
  if (value === REDACTED_EVENT_VALUE) return true;
  if (Array.isArray(value)) return value.some(containsRedacted);
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).some(containsRedacted);
}

// ── Shortname collision ────────────────────────────────────────────────────

export function shortnameExists(
  name: string,
  agents: ShortnameCandidate[],
  opts?: ShortnameOptions,
): boolean {
  const key = normalizeAgentUrlKey(name);
  if (!key) return false;
  return agents.some((a) => {
    if (a.status === "terminated") return false;
    if (opts?.excludeAgentId && a.id === opts.excludeAgentId) return false;
    return normalizeAgentUrlKey(a.name) === key;
  });
}

export function uniqueName(
  base: string,
  existing: ShortnameCandidate[],
): string {
  if (!shortnameExists(base, existing)) return base;
  for (let i = 2; i <= 100; i++) {
    const candidate = `${base} ${i}`;
    if (!shortnameExists(candidate, existing)) return candidate;
  }
  return `${base} ${Date.now()}`;
}

// ── Service factory ────────────────────────────────────────────────────────

export function agentService(db: Db) {
  function attachUrlKey<T extends { id: string; name: string }>(row: T) {
    return { ...row, urlKey: normalizeAgentUrlKey(row.name) ?? row.id };
  }

  function normalize(row: typeof agents.$inferSelect) {
    return attachUrlKey({
      ...row,
      permissions: normalizeAgentPermissions(row.permissions, row.role),
    });
  }

  async function fetchById(id: string) {
    const row = await db.select().from(agents).where(eq(agents.id, id)).then((r) => r[0] ?? null);
    return row ? normalize(row) : null;
  }

  async function validateManager(projectId: string, managerId: string) {
    const mgr = await fetchById(managerId);
    if (!mgr) throw notFound("Manager not found");
    if (mgr.projectId !== projectId) throw unprocessable("Manager must belong to same project");
    return mgr;
  }

  async function detectCycle(agentId: string, reportsTo: string | null | undefined) {
    if (!reportsTo) return;
    if (reportsTo === agentId) throw unprocessable("Agent cannot report to itself");
    let current: string | null = reportsTo;
    const visited = new Set<string>();
    while (current) {
      if (current === agentId) throw unprocessable("Reporting relationship would create cycle");
      if (visited.has(current)) break;
      visited.add(current);
      const next = await fetchById(current);
      current = next?.reportsTo ?? null;
    }
  }

  async function checkShortnameAvailable(
    projectId: string,
    name: string,
    opts?: ShortnameOptions,
  ) {
    const key = normalizeAgentUrlKey(name);
    if (!key) return;

    const existing = await db
      .select({ id: agents.id, name: agents.name, status: agents.status })
      .from(agents)
      .where(eq(agents.projectId, projectId));

    if (shortnameExists(name, existing, opts)) {
      throw conflict(`Agent shortname '${key}' already in use in this project`);
    }
  }

  async function persistUpdate(
    id: string,
    patch: Partial<typeof agents.$inferInsert>,
    opts?: UpdateOptions,
  ) {
    const current = await fetchById(id);
    if (!current) return null;

    if (current.status === "terminated" && patch.status && patch.status !== "terminated") {
      throw conflict("Terminated agents cannot be resumed");
    }
    if (
      current.status === "pending_approval" &&
      patch.status &&
      patch.status !== "pending_approval" &&
      patch.status !== "terminated"
    ) {
      throw conflict("Pending approval agents cannot be activated directly");
    }

    if (patch.reportsTo !== undefined) {
      if (patch.reportsTo) await validateManager(current.projectId, patch.reportsTo);
      await detectCycle(id, patch.reportsTo);
    }

    if (patch.name !== undefined) {
      const prev = normalizeAgentUrlKey(current.name);
      const next = normalizeAgentUrlKey(patch.name);
      if (prev !== next) await checkShortnameAvailable(current.projectId, patch.name, { excludeAgentId: id });
    }

    const normalized = { ...patch } as Partial<typeof agents.$inferInsert>;
    if (patch.permissions !== undefined) {
      const role = (patch.role ?? current.role) as string;
      normalized.permissions = normalizeAgentPermissions(patch.permissions, role);
    }

    const shouldSnapshot = Boolean(opts?.recordRevision) && hasPatchFields(normalized);
    const before = shouldSnapshot ? captureSnapshot(current) : null;

    const updated = await db
      .update(agents)
      .set({ ...normalized, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning()
      .then((r) => r[0] ?? null);

    const result = updated ? normalize(updated) : null;

    if (result && shouldSnapshot && before) {
      const after = captureSnapshot(result);
      const changed = changedFields(before, after);
      if (changed.length > 0) {
        await db.insert(agentConfigRevisions).values({
          projectId: result.projectId,
          agentId: result.id,
          createdByAgentId: opts?.recordRevision?.createdByAgentId ?? null,
          createdByUserId: opts?.recordRevision?.createdByUserId ?? null,
          source: opts?.recordRevision?.source ?? "patch",
          rolledBackFromRevisionId: opts?.recordRevision?.rolledBackFromRevisionId ?? null,
          changedKeys: changed,
          beforeConfig: before as unknown as Record<string, unknown>,
          afterConfig: after as unknown as Record<string, unknown>,
        });
      }
    }

    return result;
  }

  return {
    list: async (projectId: string, opts?: { includeTerminated?: boolean }) => {
      const conditions = [eq(agents.projectId, projectId)];
      if (!opts?.includeTerminated) conditions.push(ne(agents.status, "terminated"));
      const rows = await db.select().from(agents).where(and(...conditions));
      return rows.map(normalize);
    },

    getById: fetchById,

    create: async (projectId: string, data: Omit<typeof agents.$inferInsert, "projectId">) => {
      if (data.reportsTo) await validateManager(projectId, data.reportsTo);

      const existing = await db
        .select({ id: agents.id, name: agents.name, status: agents.status })
        .from(agents)
        .where(eq(agents.projectId, projectId));

      const uniqueName_ = uniqueName(data.name, existing);
      const role = data.role ?? "general";
      const perms = normalizeAgentPermissions(data.permissions, role);

      const created = await db
        .insert(agents)
        .values({ ...data, name: uniqueName_, projectId, role, permissions: perms })
        .returning()
        .then((r) => r[0]);

      return normalize(created);
    },

    update: persistUpdate,

    pause: async (id: string) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      if (existing.status === "terminated") throw conflict("Cannot pause terminated agent");
      const updated = await db
        .update(agents)
        .set({ status: "paused", updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((r) => r[0] ?? null);
      return updated ? normalize(updated) : null;
    },

    resume: async (id: string) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      if (existing.status === "terminated") throw conflict("Cannot resume terminated agent");
      if (existing.status === "pending_approval") throw conflict("Pending approval agents cannot be resumed");
      const updated = await db
        .update(agents)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((r) => r[0] ?? null);
      return updated ? normalize(updated) : null;
    },

    terminate: async (id: string) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      await db.update(agents).set({ status: "terminated", updatedAt: new Date() }).where(eq(agents.id, id));
      await db.update(agentApiKeys).set({ revokedAt: new Date() }).where(eq(agentApiKeys.agentId, id));
      return fetchById(id);
    },

    remove: async (id: string) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      return db.transaction(async (tx) => {
        await tx.update(agents).set({ reportsTo: null }).where(eq(agents.reportsTo, id));
        await tx.delete(heartbeatRunEvents).where(eq(heartbeatRunEvents.agentId, id));
        await tx.delete(agentTaskSessions).where(eq(agentTaskSessions.agentId, id));
        await tx.delete(heartbeatRuns).where(eq(heartbeatRuns.agentId, id));
        await tx.delete(agentWakeupRequests).where(eq(agentWakeupRequests.agentId, id));
        await tx.delete(agentApiKeys).where(eq(agentApiKeys.agentId, id));
        await tx.delete(agentRuntimeState).where(eq(agentRuntimeState.agentId, id));
        const deleted = await tx.delete(agents).where(eq(agents.id, id)).returning().then((r) => r[0] ?? null);
        return deleted ? normalize(deleted) : null;
      });
    },

    activatePendingApproval: async (id: string) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      if (existing.status !== "pending_approval") return existing;
      const updated = await db
        .update(agents)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((r) => r[0] ?? null);
      return updated ? normalize(updated) : null;
    },

    updatePermissions: async (id: string, perms: { canCreateAgents: boolean }) => {
      const existing = await fetchById(id);
      if (!existing) return null;
      const updated = await db
        .update(agents)
        .set({ permissions: normalizeAgentPermissions(perms, existing.role), updatedAt: new Date() })
        .where(eq(agents.id, id))
        .returning()
        .then((r) => r[0] ?? null);
      return updated ? normalize(updated) : null;
    },

    listConfigRevisions: async (id: string) =>
      db.select().from(agentConfigRevisions).where(eq(agentConfigRevisions.agentId, id)).orderBy(desc(agentConfigRevisions.createdAt)),

    getConfigRevision: async (id: string, revId: string) =>
      db
        .select()
        .from(agentConfigRevisions)
        .where(and(eq(agentConfigRevisions.agentId, id), eq(agentConfigRevisions.id, revId)))
        .then((r) => r[0] ?? null),

    rollbackConfigRevision: async (
      id: string,
      revId: string,
      actor: { agentId?: string | null; userId?: string | null },
    ) => {
      const rev = await db
        .select()
        .from(agentConfigRevisions)
        .where(and(eq(agentConfigRevisions.agentId, id), eq(agentConfigRevisions.id, revId)))
        .then((r) => r[0] ?? null);
      if (!rev) return null;
      if (containsRedacted(rev.afterConfig)) {
        throw unprocessable("Cannot roll back a revision containing redacted secrets");
      }
      return persistUpdate(id, patchFromSnapshot(rev.afterConfig), {
        recordRevision: {
          createdByAgentId: actor.agentId ?? null,
          createdByUserId: actor.userId ?? null,
          source: "rollback",
          rolledBackFromRevisionId: rev.id,
        },
      });
    },

    createApiKey: async (id: string, name: string) => {
      const existing = await fetchById(id);
      if (!existing) throw notFound("Agent not found");
      if (existing.status === "pending_approval") throw conflict("Cannot create keys for pending approval agents");
      if (existing.status === "terminated") throw conflict("Cannot create keys for terminated agents");

      const token = generateToken();
      const hash = deriveTokenHash(token);
      const created = await db
        .insert(agentApiKeys)
        .values({ agentId: id, projectId: existing.projectId, name, keyHash: hash })
        .returning()
        .then((r) => r[0]);

      return { id: created.id, name: created.name, token, createdAt: created.createdAt };
    },

    listKeys: (id: string) =>
      db
        .select({ id: agentApiKeys.id, name: agentApiKeys.name, createdAt: agentApiKeys.createdAt, revokedAt: agentApiKeys.revokedAt })
        .from(agentApiKeys)
        .where(eq(agentApiKeys.agentId, id)),

    revokeKey: async (keyId: string) => {
      const rows = await db.update(agentApiKeys).set({ revokedAt: new Date() }).where(eq(agentApiKeys.id, keyId)).returning();
      return rows[0] ?? null;
    },

    orgForProject: async (projectId: string) => {
      const rows = await db
        .select()
        .from(agents)
        .where(and(eq(agents.projectId, projectId), ne(agents.status, "terminated")));
      const normalized = rows.map(normalize);
      const byManager = new Map<string | null, typeof normalized>();
      for (const row of normalized) {
        const key = row.reportsTo ?? null;
        const group = byManager.get(key) ?? [];
        group.push(row);
        byManager.set(key, group);
      }
      const build = (managerId: string | null): Array<Record<string, unknown>> => {
        const members = byManager.get(managerId) ?? [];
        return members.map((m) => ({ ...m, reports: build(m.id) }));
      };
      return build(null);
    },

    getChainOfCommand: async (agentId: string) => {
      const chain: { id: string; name: string; role: string; title: string | null }[] = [];
      const visited = new Set<string>([agentId]);
      const start = await fetchById(agentId);
      let current = start?.reportsTo ?? null;
      while (current && !visited.has(current) && chain.length < 50) {
        visited.add(current);
        const mgr = await fetchById(current);
        if (!mgr) break;
        chain.push({ id: mgr.id, name: mgr.name, role: mgr.role, title: mgr.title ?? null });
        current = mgr.reportsTo ?? null;
      }
      return chain;
    },

    runningForAgent: (agentId: string) =>
      db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.agentId, agentId), inArray(heartbeatRuns.status, ["queued", "running"]))),

    resolveByReference: async (projectId: string, reference: string) => {
      const raw = reference.trim();
      if (raw.length === 0) return { agent: null, ambiguous: false } as const;

      if (isUuidLike(raw)) {
        const byId = await fetchById(raw);
        if (!byId || byId.projectId !== projectId) return { agent: null, ambiguous: false } as const;
        return { agent: byId, ambiguous: false } as const;
      }

      const urlKey = normalizeAgentUrlKey(raw);
      if (!urlKey) return { agent: null, ambiguous: false } as const;

      const rows = await db.select().from(agents).where(eq(agents.projectId, projectId));
      const matches = rows.map(normalize).filter((a) => a.urlKey === urlKey && a.status !== "terminated");
      if (matches.length === 1) return { agent: matches[0] ?? null, ambiguous: false } as const;
      if (matches.length > 1) return { agent: null, ambiguous: true } as const;
      return { agent: null, ambiguous: false } as const;
    },
  };
}

export type AgentService = ReturnType<typeof agentService>;

// Alias for backwards compatibility
export { uniqueName as deduplicateAgentName };
export { shortnameExists as hasAgentShortnameCollision };
