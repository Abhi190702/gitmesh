import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PROJECT_COLORS, isUuidLike, type ProjectOrgStatus } from "@gitmesh/core";
import type { Subproject } from "@gitmesh/core";
import { subprojectsApi } from "../../api/subprojects";
import { projectsApi } from "../../api/projects-api";
import { issuesApi } from "../../api/issues";
import { agentsApi } from "../../api/agents";
import { heartbeatsApi } from "../../api/heartbeats";
import { assetsApi } from "../../api/assets";
import { ApiError } from "../../api/client";
import { usePanel } from "../../context/PanelContext";
import { useProject } from "../../context/ProjectContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { SubprojectProperties } from "../../features/SubprojectProperties";
import { InlineEditor } from "../../components/InlineEditor";
import { StatusBadge } from "../../components/StatusBadge";
import { IssuesList } from "../../features/IssuesList";
import { PageSkeleton } from "../../components/PageSkeleton";
import { subprojectRouteRef, cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SlidersHorizontal } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

type TabType = "overview" | "list";

type LoadedProject = {
  kind: "subproject" | "project";
  data: Subproject;
};

// ── Project conversion ─────────────────────────────────────────────────────

function toSubprojectFormat(routeRef: string, project: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  brandColor: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Subproject {
  return {
    id: routeRef,
    projectId: project.id,
    goalId: null,
    name: project.name,
    description: project.description,
    status: project.status,
    leadAgentId: null,
    targetDate: null,
    color: project.brandColor,
    archivedAt: null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    goalIds: [],
    goals: [],
    workspaces: [],
    milestoneIds: [],
    milestoneId: null,
  };
}

// ── Tab resolution ────────────────────────────────────────────────────────

function resolveTab(pathname: string, projectId: string): TabType | null {
  const segments = pathname.split("/").filter(Boolean);
  const projectsIdx = segments.indexOf("projects");
  if (projectsIdx === -1 || segments[projectsIdx + 1] !== projectId) return null;
  const tab = segments[projectsIdx + 2];
  if (tab === "overview") return "overview";
  if (tab === "issues") return "list";
  return null;
}

// ── Overview content ─────────────────────────────────────────────────────

function OverviewTab({
  project,
  onUpdate,
  imageHandler,
}: {
  project: { description: string | null; status: string; targetDate: string | null };
  onUpdate: (data: Record<string, unknown>) => void;
  imageHandler?: (file: File) => Promise<string>;
}) {
  return (
    <div className="space-y-6">
      <InlineEditor
        value={project.description ?? ""}
        onSave={(description) => onUpdate({ description })}
        as="p"
        className="text-sm text-muted-foreground"
        placeholder="Add a description..."
        multiline
        imageUploadHandler={imageHandler}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Status</span>
          <div className="mt-1"><StatusBadge status={project.status} /></div>
        </div>
        {project.targetDate && (
          <div>
            <span className="text-muted-foreground">Target Date</span>
            <p>{project.targetDate}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Color picker ─────────────────────────────────────────────────────────

function ColorSwatchPicker({
  currentColor,
  onSelect,
}: {
  currentColor: string;
  onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="shrink-0 h-5 w-5 rounded-md cursor-pointer hover:ring-2 hover:ring-foreground/20 transition-[box-shadow]"
        style={{ backgroundColor: currentColor }}
        aria-label="Change project color"
      />
      {open && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-popover border border-border rounded-lg shadow-lg z-50 w-max">
          <div className="grid grid-cols-5 gap-1.5">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { onSelect(color); setOpen(false); }}
                className={`h-6 w-6 rounded-md cursor-pointer transition-[transform,box-shadow] duration-150 hover:scale-110 ${
                  color === currentColor ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "hover:ring-2 hover:ring-foreground/30"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Issues list tab ────────────────────────────────────────────────────────

function IssuesListTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(projectId),
    queryFn: () => agentsApi.list(projectId),
    enabled: !!projectId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(projectId),
    queryFn: () => heartbeatsApi.liveRunsForProject(projectId),
    enabled: !!projectId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.listByProject(projectId, projectId),
    queryFn: () => issuesApi.list(projectId, { projectId }),
    enabled: !!projectId,
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(projectId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(projectId) });
    },
  });

  return (
    <IssuesList
      issues={issues ?? []}
      isLoading={isLoading}
      error={error as Error | null}
      agents={agents}
      liveIssueIds={liveIssueIds}
      projectId={projectId}
      viewStateKey={`gitmesh-agents:project-view:${projectId}`}
      onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function SubprojectDetail() {
  const { projectPrefix, projectId, filter } = useParams<{
    projectPrefix?: string;
    projectId: string;
    filter?: string;
  }>();
  const { projects, selectedProjectId, setSelectedProjectId, loading: projectsLoading } = useProject();
  const { openPanel, closePanel, panelVisible, setPanelVisible } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const routeRef = projectId ?? "";
  const routeId = useMemo(() => {
    if (!projectPrefix) return null;
    const prefix = projectPrefix.toUpperCase();
    return projects.find((p) => p.issuePrefix.toUpperCase() === prefix)?.id ?? null;
  }, [projects, projectPrefix]);
  const lookupId = routeId ?? selectedProjectId ?? undefined;
  const canFetch = routeRef.length > 0 && (isUuidLike(routeRef) || Boolean(lookupId));

  const activeTab = routeRef ? resolveTab(location.pathname, routeRef) : null;

  const { data: loadedProject, isLoading, error } = useQuery<LoadedProject>({
    queryKey: [...queryKeys.subprojects.detail(routeRef), lookupId ?? null],
    queryFn: async () => {
      try {
        return { kind: "subproject" as const, data: await subprojectsApi.get(routeRef, lookupId) };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404 && lookupId) {
          const project = await projectsApi.get(lookupId);
          return { kind: "project" as const, data: toSubprojectFormat(routeRef, project) };
        }
        throw err;
      }
    },
    enabled: canFetch,
  });

  const project = loadedProject?.data ?? null;
  const projectKind = loadedProject?.kind ?? null;
  const canonicalRef = project ? subprojectRouteRef(project) : routeRef;
  const lookupRef = project?.id ?? routeRef;
  const resolvedProjectId = project?.projectId ?? selectedProjectId;

  useEffect(() => {
    if (!project?.projectId || project.projectId === selectedProjectId) return;
    setSelectedProjectId(project.projectId, { source: "route_sync" });
  }, [project?.projectId, selectedProjectId, setSelectedProjectId]);

  const invalidateProject = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.subprojects.detail(routeRef) });
    queryClient.invalidateQueries({ queryKey: queryKeys.subprojects.detail(lookupRef) });
    if (resolvedProjectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.subprojects.list(resolvedProjectId) });
    }
  };

  const updateProject = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (projectKind === "project") {
        if (!resolvedProjectId) throw new Error("No project selected");
        const mapped: Parameters<typeof projectsApi.update>[1] = {};
        if (data.name !== undefined) mapped.name = String(data.name);
        if (data.description !== undefined) mapped.description = data.description ? String(data.description) : null;
        if (data.status !== undefined) mapped.status = String(data.status) as ProjectOrgStatus;
        if (data.color !== undefined) mapped.brandColor = data.color ? String(data.color) : null;
        return projectsApi.update(resolvedProjectId, mapped);
      }
      return subprojectsApi.update(lookupRef, data, resolvedProjectId ?? lookupId);
    },
    onSuccess: invalidateProject,
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedProjectId) throw new Error("No project selected");
      return assetsApi.uploadImage(resolvedProjectId, file, `projects/${lookupRef || "draft"}`);
    },
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Projects", href: "/projects" },
      { label: project?.name ?? routeRef ?? "Project" },
    ]);
  }, [setBreadcrumbs, project, routeRef]);

  useEffect(() => {
    if (!project) return;
    if (routeRef === canonicalRef) return;
    if (activeTab === "overview") {
      navigate(`/projects/${canonicalRef}/overview`, { replace: true });
      return;
    }
    if (activeTab === "list") {
      navigate(`/projects/${canonicalRef}/issues${filter ? `/${filter}` : ""}`, { replace: true });
      return;
    }
    navigate(`/projects/${canonicalRef}`, { replace: true });
  }, [project, routeRef, canonicalRef, activeTab, filter, navigate]);

  useEffect(() => {
    if (project) {
      openPanel(
        <SubprojectProperties
          project={project}
          onUpdate={projectKind === "subproject" ? (data) => updateProject.mutate(data) : undefined}
        />,
      );
    }
    return () => closePanel();
  }, [project, projectKind]);

  // Redirect bare /projects/:id to /projects/:id/issues
  if (routeRef && activeTab === null) {
    return <Navigate to={`/projects/${canonicalRef}/issues`} replace />;
  }

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  // Avoid blank page: disable query (?canFetch=false) until prefix resolves; or wait for projects list.
  if (!project) {
    if (!canFetch || projectsLoading) {
      return <PageSkeleton variant="detail" />;
    }
    return (
      <p className="text-sm text-muted-foreground">
        This subproject could not be loaded (check URL prefix matches a project).
      </p>
    );
  }

  const handleTabChange = (tab: TabType) => {
    if (tab === "overview") navigate(`/projects/${canonicalRef}/overview`);
    else navigate(`/projects/${canonicalRef}/issues`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-7 flex items-center">
          <ColorSwatchPicker
            currentColor={project.color ?? "#6366f1"}
            onSelect={(color) => updateProject.mutate({ color })}
          />
        </div>
        <InlineEditor
          value={project.name}
          onSave={(name) => updateProject.mutate({ name })}
          as="h2"
          className="text-xl font-bold"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto md:hidden shrink-0"
          onClick={() => setMobilePropsOpen(true)}
          title="Properties"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            "shrink-0 ml-auto transition-opacity duration-200 hidden md:flex",
            panelVisible ? "opacity-0 pointer-events-none w-0 overflow-hidden" : "opacity-100",
          )}
          onClick={() => setPanelVisible(true)}
          title="Show properties"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "overview"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("overview")}
        >
          Overview
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "list"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => handleTabChange("list")}
        >
          List
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          project={project}
          onUpdate={(data) => updateProject.mutate(data)}
          imageHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentPath;
          }}
        />
      )}

      {activeTab === "list" && resolvedProjectId && (
        <IssuesListTab projectId={resolvedProjectId} />
      )}

      {/* Mobile properties drawer */}
      <Sheet open={mobilePropsOpen} onOpenChange={setMobilePropsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-sm">Properties</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-4 pb-4">
              <SubprojectProperties
                project={project}
                onUpdate={projectKind === "subproject" ? (data) => updateProject.mutate(data) : undefined}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
