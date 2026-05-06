import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { milestonesApi } from "../../api/milestones";
import { subprojectsApi } from "../../api/subprojects";
import { assetsApi } from "../../api/assets";
import { usePanel } from "../../context/PanelContext";
import { useProject } from "../../context/ProjectContext";
import { useDialog } from "../../context/DialogContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { MilestoneProperties } from "../../features/MilestoneProperties";
import { MilestoneTree } from "../../features/MilestoneTree";
import { StatusBadge } from "../../components/StatusBadge";
import { InlineEditor } from "../../components/InlineEditor";
import { EntityRow } from "../../components/EntityRow";
import { PageSkeleton } from "../../components/PageSkeleton";
import { subprojectUrl } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import type { Goal, Project } from "@gitmesh/core";

export function MilestoneDetail() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const { openNewGoal } = useDialog();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const {
    data: milestone,
    isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.milestones.detail(milestoneId!),
    queryFn: () => milestonesApi.get(milestoneId!),
    enabled: !!milestoneId
  });
  const resolvedProjectId = milestone?.projectId ?? selectedProjectId;

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.milestones.list(resolvedProjectId!),
    queryFn: () => milestonesApi.list(resolvedProjectId!),
    enabled: !!resolvedProjectId
  });

  const { data: allProjects } = useQuery({
    queryKey: queryKeys.subprojects.list(resolvedProjectId!),
    queryFn: () => subprojectsApi.list(resolvedProjectId!),
    enabled: !!resolvedProjectId
  });

  useEffect(() => {
    if (!milestone?.projectId || milestone.projectId === selectedProjectId) return;
    setSelectedProjectId(milestone.projectId, { source: "route_sync" });
  }, [milestone?.projectId, selectedProjectId, setSelectedProjectId]);

  const updateGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      milestonesApi.update(milestoneId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.milestones.detail(milestoneId!)
      });
      if (resolvedProjectId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.milestones.list(resolvedProjectId)
        });
      }
    }
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedProjectId) throw new Error("No project selected");
      return assetsApi.uploadImage(
        resolvedProjectId,
        file,
        `goals/${milestoneId ?? "draft"}`
      );
    }
  });

  const childGoals = (allGoals ?? []).filter((g) => g.parentId === milestoneId);
  const linkedProjects = (allProjects ?? []).filter((p) => {
    if (!milestoneId) return false;
    if (p.milestoneIds?.includes(milestoneId)) return true;
    if (p.goals?.some((goalRef) => goalRef.id === milestoneId)) return true;
    return p.milestoneId === milestoneId;
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Milestones", href: "/milestones" },
      { label: milestone?.title ?? milestoneId ?? "Milestone" }
    ]);
  }, [setBreadcrumbs, milestone, milestoneId]);

  useEffect(() => {
    if (milestone) {
      openPanel(
        <MilestoneProperties
          milestone={milestone}
          onUpdate={(data) => updateGoal.mutate(data)}
        />
      );
    }
    return () => closePanel();
  }, [milestone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!milestone) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">
            {milestone.level}
          </span>
          <StatusBadge status={milestone.status} />
        </div>

        <InlineEditor
          value={milestone.title}
          onSave={(title) => updateGoal.mutate({ title })}
          as="h2"
          className="text-xl font-bold"
        />

        <InlineEditor
          value={milestone.description ?? ""}
          onSave={(description) => updateGoal.mutate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
          imageUploadHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentPath;
          }}
        />
      </div>

      <Tabs defaultValue="children">
        <TabsList>
          <TabsTrigger value="children">
            Sub-Goals ({childGoals.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({linkedProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children" className="mt-4 space-y-3">
          <div className="flex items-center justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openNewGoal({ parentId: milestoneId })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Sub Goal
            </Button>
          </div>
          {childGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sub-goals.</p>
          ) : (
            <MilestoneTree goals={childGoals} milestoneLink={(g) => `/milestones/${g.id}`} />
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          {linkedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked projects.</p>
          ) : (
            <div className="border border-border">
              {linkedProjects.map((project) => (
                <EntityRow
                  key={project.id}
                  title={project.name}
                  subtitle={project.description ?? undefined}
                  to={subprojectUrl(project)}
                  trailing={<StatusBadge status={project.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
