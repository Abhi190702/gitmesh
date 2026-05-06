/**
 * New milestone dialog: uses `useFormDialog` for draft / submit / close;
 * this component focuses on render-only UI.
 */

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GOAL_STATUSES, GOAL_LEVELS } from "@gitmesh/core";
import { useDialog } from "../context/DialogContext";
import { useProject } from "../context/ProjectContext";
import { milestonesApi } from "../api/milestones";
import { assetsApi } from "../api/assets";
import { queryKeys } from "../lib/queryKeys";
import { useFormDialog } from "../hooks/useFormDialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Maximize2, Minimize2, Target, Layers } from "lucide-react";
import { cn } from "../lib/utils";
import { MarkdownEditor, type MarkdownEditorRef } from "../components/MarkdownEditor";
import { StatusBadge } from "../components/StatusBadge";

const levelLabels: Record<string, string> = {
  project: "Project",
  team: "Team",
  agent: "Agent",
  task: "Task",
};

interface MilestoneDraft {
  title: string;
  description: string;
  status: string;
  level: string;
  parentId: string;
  expanded: boolean;
}

const INITIAL_DRAFT: MilestoneDraft = {
  title: "",
  description: "",
  status: "planned",
  level: "task",
  parentId: "",
  expanded: false,
};

export function NewMilestoneDialog() {
  const { newGoalOpen, newGoalDefaults, closeNewGoal } = useDialog();
  const { selectedProjectId, selectedProject } = useProject();
  const queryClient = useQueryClient();
  const descriptionEditorRef = useRef<MarkdownEditorRef>(null);

  const { data: goals } = useQuery({
    queryKey: queryKeys.milestones.list(selectedProjectId!),
    queryFn: () => milestonesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId && newGoalOpen,
  });

  const form = useFormDialog<MilestoneDraft>({
    open: newGoalOpen,
    onClose: closeNewGoal,
    initial: INITIAL_DRAFT,
    validate: (d) => Boolean(d.title.trim()) && Boolean(selectedProjectId),
    onSubmit: async (d) => {
      const appliedParentId = d.parentId || newGoalDefaults.parentId || "";
      await milestonesApi.create(selectedProjectId!, {
        title: d.title.trim(),
        description: d.description.trim() || undefined,
        status: d.status,
        level: d.level,
        ...(appliedParentId ? { parentId: appliedParentId } : {}),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones.list(selectedProjectId!) });
    },
  });

  const appliedParentId = form.draft.parentId || newGoalDefaults.parentId || "";
  const currentParent = (goals ?? []).find((g) => g.id === appliedParentId);

  return (
    <Dialog open={newGoalOpen} onOpenChange={form.handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn("p-0 gap-0", form.draft.expanded ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onKeyDown={form.handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {selectedProject && (
              <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-medium">
                {selectedProject.name.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="text-muted-foreground/60">&rsaquo;</span>
            <span>{newGoalDefaults.parentId ? "New sub-milestone" : "New milestone"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => form.set("expanded", !form.draft.expanded)}
              aria-label={form.draft.expanded ? "Collapse" : "Expand"}
            >
              {form.draft.expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              onClick={() => form.handleOpenChange(false)}
              aria-label="Close"
            >
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <input
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Goal title"
            value={form.draft.title}
            onChange={(e) => form.set("title", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                descriptionEditorRef.current?.focus();
              }
            }}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <MarkdownEditor
            ref={descriptionEditorRef}
            value={form.draft.description}
            onChange={(v) => form.set("description", v)}
            placeholder="Add description..."
            bordered={false}
            contentClassName={cn(
              "text-sm text-muted-foreground",
              form.draft.expanded ? "min-h-[220px]" : "min-h-[120px]",
            )}
            imageUploadHandler={async (file) => {
              if (!selectedProjectId) throw new Error("No project selected");
              const asset = await assetsApi.uploadImage(selectedProjectId, file, "goals/drafts");
              return asset.contentPath;
            }}
          />
        </div>

        {/* Property chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
          <PropertyPicker
            label={<StatusBadge status={form.draft.status} />}
            options={[...GOAL_STATUSES]}
            current={form.draft.status}
            onChange={(s) => form.set("status", s)}
            width="w-40"
          />

          <PropertyPicker
            label={
              <>
                <Layers className="h-3 w-3 text-muted-foreground" />
                {levelLabels[form.draft.level] ?? form.draft.level}
              </>
            }
            options={[...GOAL_LEVELS]}
            current={form.draft.level}
            onChange={(l) => form.set("level", l)}
            renderOption={(opt) => levelLabels[opt] ?? opt}
            width="w-40"
          />

          <ParentPicker
            current={appliedParentId}
            label={
              <>
                <Target className="h-3 w-3 text-muted-foreground" />
                {currentParent ? currentParent.title : "Parent milestone"}
              </>
            }
            goals={goals ?? []}
            onChange={(id) => form.set("parentId", id)}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 border-t border-border">
          <Button
            size="sm"
            disabled={!form.canSubmit || form.submitting}
            onClick={() => void form.submit()}
          >
            {form.submitting
              ? "Creating…"
              : newGoalDefaults.parentId
                ? "Create sub-milestone"
                : "Create milestone"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- small focused subcomponents ------------------------------------------

function PropertyPicker({
  label,
  options,
  current,
  onChange,
  renderOption,
  width = "w-40",
}: {
  label: React.ReactNode;
  options: string[];
  current: string;
  onChange: (v: string) => void;
  renderOption?: (v: string) => React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-1", width)} align="start">
        {options.map((opt) => (
          <button
            key={opt}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 capitalize",
              opt === current && "bg-accent",
            )}
            onClick={() => {
              onChange(opt);
              setOpen(false);
            }}
          >
            {renderOption ? renderOption(opt) : opt}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ParentPicker({
  current,
  label,
  goals,
  onChange,
}: {
  current: string;
  label: React.ReactNode;
  goals: Array<{ id: string; title: string }>;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <button
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
            !current && "bg-accent",
          )}
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          No parent
        </button>
        {goals.map((g) => (
          <button
            key={g.id}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
              g.id === current && "bg-accent",
            )}
            onClick={() => {
              onChange(g.id);
              setOpen(false);
            }}
          >
            {g.title}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
