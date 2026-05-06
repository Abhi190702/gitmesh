import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Check, GripVertical, ChevronDown } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useProject } from "../context/ProjectContext";
import { useDialog } from "../context/DialogContext";
import { cn } from "../lib/utils";
import { queryKeys } from "../lib/queryKeys";
import { heartbeatsApi } from "../api/heartbeats";
import { ProjectPatternIcon } from "./ProjectPatternIcon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ORDER_STORAGE_KEY = "gitmesh-agents.projectOrder";

function getStoredOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveOrder(ids: string[]) {
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids));
}

import type { Project } from "@gitmesh/core";

/** Sort projects by stored order, appending any new ones at the end. */
function sortByStoredOrder(projects: Project[]): Project[] {
  const order = getStoredOrder();
  if (order.length === 0) return projects;

  const byId = new Map(projects.map((c) => [c.id, c]));
  const sorted: Project[] = [];

  for (const id of order) {
    const c = byId.get(id);
    if (c) {
      sorted.push(c);
      byId.delete(id);
    }
  }
  for (const c of byId.values()) {
    sorted.push(c);
  }
  return sorted;
}

function SortableProjectRow({
  project,
  isSelected,
  hasLiveAgents,
  onSelect,
}: {
  project: Project;
  isSelected: boolean;
  hasLiveAgents: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-accent/60 text-foreground",
        isDragging && "shadow-md"
      )}
      onClick={onSelect}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground shrink-0">
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <ProjectPatternIcon
        projectName={project.name}
        brandColor={project.brandColor}
        className="w-6 h-6 rounded-md shrink-0 text-[9px]"
      />
      <span className="flex-1 text-sm font-medium truncate">{project.name}</span>
      {hasLiveAgents && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
        </span>
      )}
      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </div>
  );
}

export function ProjectSwitcher() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId } = useProject();
  const { openOnboarding } = useDialog();
  const [open, setOpen] = useState(false);

  const sidebarProjects = useMemo(
    () => projects.filter((project) => project.status !== "archived"),
    [projects],
  );
  const projectIds = useMemo(() => sidebarProjects.map((p) => p.id), [sidebarProjects]);

  const liveRunsQueries = useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: queryKeys.liveRuns(projectId),
      queryFn: () => heartbeatsApi.liveRunsForProject(projectId),
      refetchInterval: 10_000,
    })),
  });

  const hasLiveAgentsByProjectId = useMemo(() => {
    const result = new Map<string, boolean>();
    projectIds.forEach((projectId, index) => {
      result.set(projectId, (liveRunsQueries[index]?.data?.length ?? 0) > 0);
    });
    return result;
  }, [projectIds, liveRunsQueries]);

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    sortByStoredOrder(sidebarProjects).map((c) => c.id)
  );

  useEffect(() => {
    if (sidebarProjects.length === 0) {
      setOrderedIds([]);
      return;
    }
    setOrderedIds(sortByStoredOrder(sidebarProjects).map((c) => c.id));
  }, [sidebarProjects]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== ORDER_STORAGE_KEY) return;
      try {
        const ids: string[] = e.newValue ? JSON.parse(e.newValue) : [];
        setOrderedIds(ids);
      } catch { /* ignore malformed data */ }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const orderedProjects = useMemo(() => {
    const byId = new Map(sidebarProjects.map((c) => [c.id, c]));
    const result: Project[] = [];
    for (const id of orderedIds) {
      const c = byId.get(id);
      if (c) {
        result.push(c);
        byId.delete(id);
      }
    }
    for (const c of byId.values()) {
      result.push(c);
    }
    return result;
  }, [sidebarProjects, orderedIds]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = orderedProjects.map((c) => c.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newIds = arrayMove(ids, oldIndex, newIndex);
      setOrderedIds(newIds);
      saveOrder(newIds);
    },
    [orderedProjects]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2 rounded-md border border-border bg-surface-2/50 px-2 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          {selectedProject ? (
            <>
              <ProjectPatternIcon
                projectName={selectedProject.name}
                brandColor={selectedProject.brandColor}
                className="h-7 w-7 shrink-0 rounded-sm text-[9px]"
              />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {selectedProject.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                  {selectedProject.issuePrefix}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="h-7 w-7 shrink-0 rounded-sm border border-border" />
              <span className="flex-1 text-[13px] text-text-tertiary">Select project</span>
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedProjects.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedProjects.map((project) => (
                <SortableProjectRow
                  key={project.id}
                  project={project}
                  isSelected={project.id === selectedProjectId}
                  hasLiveAgents={hasLiveAgentsByProjectId.get(project.id) ?? false}
                  onSelect={() => {
                    setSelectedProjectId(project.id);
                    setOpen(false);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="border-t border-border mt-2 pt-2">
          <button
            onClick={() => {
              openOnboarding();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
