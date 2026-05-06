import type { Subproject } from "@gitmesh/core";

export const SUBPROJECT_ORDER_UPDATED_EVENT = "gitmesh-agents:project-order-updated";
const PROJECT_ORDER_STORAGE_PREFIX = "gitmesh-agents.projectOrder";
const ANONYMOUS_USER_ID = "anonymous";

type ProjectOrderUpdatedDetail = {
  storageKey: string;
  orderedIds: string[];
};

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function resolveUserId(userId: string | null | undefined): string {
  if (!userId) return ANONYMOUS_USER_ID;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : ANONYMOUS_USER_ID;
}

export function getProjectOrderStorageKey(projectId: string, userId: string | null | undefined): string {
  return `${PROJECT_ORDER_STORAGE_PREFIX}:${projectId}:${resolveUserId(userId)}`;
}

export function readProjectOrder(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    return normalizeIdList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeProjectOrder(storageKey: string, orderedIds: string[]) {
  const normalized = normalizeIdList(orderedIds);
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<ProjectOrderUpdatedDetail>(SUBPROJECT_ORDER_UPDATED_EVENT, {
        detail: { storageKey, orderedIds: normalized },
      }),
    );
  }
}

export function sortProjectsByStoredOrder(projects: Subproject[], orderedIds: string[]): Subproject[] {
  if (projects.length === 0) return [];
  if (orderedIds.length === 0) return projects;

  const byId = new Map(projects.map((project) => [project.id, project]));
  const sorted: Subproject[] = [];

  for (const id of orderedIds) {
    const project = byId.get(id);
    if (!project) continue;
    sorted.push(project);
    byId.delete(id);
  }
  for (const project of byId.values()) {
    sorted.push(project);
  }
  return sorted;
}
