import type { SidebarBadges } from "@gitmesh/core";
import { api } from "./client";

export const sidebarBadgesApi = {
  get: (projectId: string) => api.get<SidebarBadges>(`/projects/${projectId}/sidebar-badges`),
};
