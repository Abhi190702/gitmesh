import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@gitmesh/core";
import { projectsApi } from '../api/projects-api';
import { ApiError } from "../api/client";
import { queryKeys } from "../lib/queryKeys";

type ProjectSelectionSource = "manual" | "route_sync" | "bootstrap";
type ProjectSelectionOptions = { source?: ProjectSelectionSource };

interface ProjectContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  selectedProject: Project | null;
  selectionSource: ProjectSelectionSource;
  loading: boolean;
  error: Error | null;
  setSelectedProjectId: (projectId: string, options?: ProjectSelectionOptions) => void;
  reloadProjects: () => Promise<void>;
  createProject: (data: {
    name: string;
    description?: string | null;
    budgetMonthlyCents?: number;
  }) => Promise<Project>;
}

const STORAGE_KEY = "gitmesh-agents.selectedProjectId";

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectionSource, setSelectionSource] = useState<ProjectSelectionSource>("bootstrap");
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: async () => {
      try {
        return await projectsApi.list();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return [];
        }
        throw err;
      }
    },
    retry: false,
  });
  const sidebarProjects = useMemo(
    () => projects.filter((project) => project.status !== "archived"),
    [projects],
  );

  // Auto-select first project when list loads
  useEffect(() => {
    if (projects.length === 0) return;

    const selectableProjects = sidebarProjects.length > 0 ? sidebarProjects : projects;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && selectableProjects.some((c) => c.id === stored)) return;
    if (selectedProjectId && selectableProjects.some((c) => c.id === selectedProjectId)) return;

    const next = selectableProjects[0]!.id;
    setSelectedProjectIdState(next);
    setSelectionSource("bootstrap");
    localStorage.setItem(STORAGE_KEY, next);
  }, [projects, selectedProjectId, sidebarProjects]);

  const setSelectedProjectId = useCallback((projectId: string, options?: ProjectSelectionOptions) => {
    setSelectedProjectIdState(projectId);
    setSelectionSource(options?.source ?? "manual");
    localStorage.setItem(STORAGE_KEY, projectId);
  }, []);

  const reloadProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string | null; budgetMonthlyCents?: number }) =>
      projectsApi.create(data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      setSelectedProjectId(project.id);
    },
  });

  const createProject = useCallback(
    async (data: { name: string; description?: string | null; budgetMonthlyCents?: number }) => {
      return createMutation.mutateAsync(data);
    },
    [createMutation],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const value = useMemo(
    () => ({
      projects,
      selectedProjectId,
      selectedProject,
      selectionSource,
      loading: isLoading,
      error: error as Error | null,
      setSelectedProjectId,
      reloadProjects,
      createProject,
    }),
    [
      projects,
      selectedProjectId,
      selectedProject,
      selectionSource,
      isLoading,
      error,
      setSelectedProjectId,
      reloadProjects,
      createProject,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
}
