import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useProject } from "../context/ProjectContext";
import { subprojectsApi } from "../api/subprojects";
import { milestonesApi } from "../api/milestones";
import { assetsApi } from "../api/assets";
import { queryKeys } from "../lib/queryKeys";
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
import {
  Maximize2,
  Minimize2,
  Target,
  Calendar,
  Plus,
  X,
  FolderOpen,
  Github,
  GitBranch,
} from "lucide-react";
import { PROJECT_COLORS } from "@gitmesh/core";
import { cn } from "../lib/utils";
import { MarkdownEditor, type MarkdownEditorRef } from "../components/MarkdownEditor";
import { StatusBadge } from "../components/StatusBadge";
import { ChoosePathButton } from "./PathInstructionsModal";

// ── Constants ─────────────────────────────────────────────────────────────

const PROJECT_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type WorkspaceSetup = "none" | "local" | "repo" | "both";
const REPO_ONLY_SENTINEL = "/__gitmesh-agents_repo_only__";

// ── Validation helpers ────────────────────────────────────────────────────

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function isGitHubUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length >= 2;
  } catch {
    return false;
  }
}

function extractFolderName(value: string): string {
  const normalized = value.trim().replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "Local folder";
}

function extractRepoName(value: string): string {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const repo = segments[segments.length - 1]?.replace(/\.git$/i, "") ?? "";
    return repo || "GitHub repo";
  } catch {
    return "GitHub repo";
  }
}

// ── Status picker ────────────────────────────────────────────────────────

function StatusPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors">
          <StatusBadge status={value} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s.value}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
              s.value === value && "bg-accent"
            )}
            onClick={() => { onChange(s.value); setOpen(false); }}
          >
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── Goal picker ──────────────────────────────────────────────────────────

function GoalPicker({
  goals,
  selectedIds,
  onAdd,
  onRemove,
}: {
  goals: { id: string; title: string }[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = goals.filter((g) => selectedIds.includes(g.id));
  const available = goals.filter((g) => !selectedIds.includes(g.id));

  return (
    <>
      {selected.map((goal) => (
        <span key={goal.id} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
          <Target className="h-3 w-3 text-muted-foreground" />
          <span className="max-w-[160px] truncate">{goal.title}</span>
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(goal.id)}
            aria-label={`Remove goal ${goal.title}`}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors disabled:opacity-60"
            disabled={selected.length > 0 && available.length === 0}
          >
            {selected.length > 0 ? <Plus className="h-3 w-3 text-muted-foreground" /> : <Target className="h-3 w-3 text-muted-foreground" />}
            {selected.length > 0 ? "+ Goal" : "Goal"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {selected.length === 0 && (
            <button
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              No goal
            </button>
          )}
          {available.map((g) => (
            <button
              key={g.id}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate"
              onClick={() => { onAdd(g.id); setOpen(false); }}
            >
              {g.title}
            </button>
          ))}
          {selected.length > 0 && available.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">All goals already selected.</div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

// ── Workspace type selector ──────────────────────────────────────────────

function WorkspaceTypeButton({
  type,
  current,
  onToggle,
  icon,
  label,
  description,
}: {
  type: WorkspaceSetup;
  current: WorkspaceSetup;
  onToggle: (t: WorkspaceSetup) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  const active = current === type;
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg border px-3 py-3 text-left transition-colors",
        active ? "border-foreground bg-accent/40" : "border-border hover:bg-accent/30"
      )}
      onClick={() => onToggle(active ? "none" : type)}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function NewSubprojectDialog() {
  const { newSubprojectOpen, closeNewSubproject } = useDialog();
  const { selectedProjectId, selectedProject } = useProject();
  const queryClient = useQueryClient();
  const descriptionRef = useRef<MarkdownEditorRef>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [goalIds, setGoalIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [workspaceSetup, setWorkspaceSetup] = useState<WorkspaceSetup>("none");
  const [workspaceLocalPath, setWorkspaceLocalPath] = useState("");
  const [workspaceRepoUrl, setWorkspaceRepoUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Goals query
  const { data: goals } = useQuery({
    queryKey: queryKeys.milestones.list(selectedProjectId!),
    queryFn: () => milestonesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId && newSubprojectOpen,
  });

  // Mutations
  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => subprojectsApi.create(selectedProjectId!, data),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedProjectId) throw new Error("No project selected");
      return assetsApi.uploadImage(selectedProjectId, file, "projects/drafts");
    },
  });

  // Reset form state
  const reset = useCallback(() => {
    setName("");
    setDescription("");
    setStatus("planned");
    setGoalIds([]);
    setTargetDate("");
    setExpanded(false);
    setWorkspaceSetup("none");
    setWorkspaceLocalPath("");
    setWorkspaceRepoUrl("");
    setWorkspaceError(null);
  }, []);

  // Toggle workspace type
  const toggleWorkspace = useCallback((type: WorkspaceSetup) => {
    setWorkspaceSetup((prev) => (prev === type ? "none" : type));
    setWorkspaceError(null);
  }, []);

  // Add/remove goals
  const addGoal = useCallback((id: string) => {
    setGoalIds((prev) => [...prev, id]);
  }, []);

  const removeGoal = useCallback((id: string) => {
    setGoalIds((prev) => prev.filter((gid) => gid !== id));
  }, []);

  // Submit handler
  const handleSubmit = async () => {
    if (!selectedProjectId || !name.trim()) return;

    const needsLocal = workspaceSetup === "local" || workspaceSetup === "both";
    const needsRepo = workspaceSetup === "repo" || workspaceSetup === "both";
    const localPath = workspaceLocalPath.trim();
    const repoUrl = workspaceRepoUrl.trim();

    if (needsLocal && !isAbsolutePath(localPath)) {
      setWorkspaceError("Local folder must be a full absolute path.");
      return;
    }
    if (needsRepo && !isGitHubUrl(repoUrl)) {
      setWorkspaceError("Repo workspace must use a valid GitHub repo URL.");
      return;
    }

    setWorkspaceError(null);

    try {
      const created = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
        ...(goalIds.length > 0 ? { goalIds } : {}),
        ...(targetDate ? { targetDate } : {}),
      });

      const workspaces: Array<Record<string, unknown>> = [];
      if (needsLocal && needsRepo) {
        workspaces.push({ name: extractFolderName(localPath), cwd: localPath, repoUrl });
      } else if (needsLocal) {
        workspaces.push({ name: extractFolderName(localPath), cwd: localPath });
      } else if (needsRepo) {
        workspaces.push({ name: extractRepoName(repoUrl), cwd: REPO_ONLY_SENTINEL, repoUrl });
      }

      for (const ws of workspaces) {
        await subprojectsApi.createWorkspace(created.id, ws);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.subprojects.list(selectedProjectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.subprojects.detail(created.id) });
      reset();
      closeNewSubproject();
    } catch { /* error state handled by createProject.isError */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={newSubprojectOpen}
      onOpenChange={(open) => {
        if (!open) { reset(); closeNewSubproject(); }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn("p-0 gap-0", expanded ? "sm:max-w-2xl" : "sm:max-w-lg")}
        onKeyDown={handleKeyDown}
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
            <span>New project</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => setExpanded(!expanded)}>
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => { reset(); closeNewSubproject(); }}>
              <span className="text-lg leading-none">&times;</span>
            </Button>
          </div>
        </div>

        {/* Name */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <input
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                descriptionRef.current?.focus();
              }
            }}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="px-4 pb-2">
          <MarkdownEditor
            ref={descriptionRef}
            value={description}
            onChange={setDescription}
            placeholder="Add description..."
            bordered={false}
            contentClassName={cn("text-sm text-muted-foreground", expanded ? "min-h-[220px]" : "min-h-[120px]")}
            imageUploadHandler={async (file) => {
              const asset = await uploadImage.mutateAsync(file);
              return asset.contentPath;
            }}
          />
        </div>

        <div className="px-4 pb-3 space-y-3 border-t border-border">
          <div className="pt-3">
            <p className="text-sm font-medium">Where will work be done on this project?</p>
            <p className="text-xs text-muted-foreground">Add local folder and/or GitHub repo workspace hints.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <WorkspaceTypeButton type="local" current={workspaceSetup} onToggle={toggleWorkspace} icon={<FolderOpen className="h-4 w-4" />} label="A local folder" description="Use a full path on this machine." />
            <WorkspaceTypeButton type="repo" current={workspaceSetup} onToggle={toggleWorkspace} icon={<Github className="h-4 w-4" />} label="A github repo" description="Paste a GitHub URL." />
            <WorkspaceTypeButton type="both" current={workspaceSetup} onToggle={toggleWorkspace} icon={<GitBranch className="h-4 w-4" />} label="Both" description="Configure local + repo hints." />
          </div>

          {(workspaceSetup === "local" || workspaceSetup === "both") && (
            <div className="rounded-md border border-border p-2">
              <label className="mb-1 block text-xs text-muted-foreground">Local folder (full path)</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none"
                  value={workspaceLocalPath}
                  onChange={(e) => setWorkspaceLocalPath(e.target.value)}
                  placeholder="/absolute/path/to/workspace"
                />
                <ChoosePathButton />
              </div>
            </div>
          )}
          {(workspaceSetup === "repo" || workspaceSetup === "both") && (
            <div className="rounded-md border border-border p-2">
              <label className="mb-1 block text-xs text-muted-foreground">GitHub repo URL</label>
              <input
                className="w-full rounded border border-border bg-transparent px-2 py-1 text-xs outline-none"
                value={workspaceRepoUrl}
                onChange={(e) => setWorkspaceRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
              />
            </div>
          )}
          {workspaceError && <p className="text-xs text-destructive">{workspaceError}</p>}
        </div>

        {/* Property chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
          <StatusPicker value={status} onChange={setStatus} />
          <GoalPicker goals={goals ?? []} selectedIds={goalIds} onAdd={addGoal} onRemove={removeGoal} />
          <div className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <input
              type="date"
              className="bg-transparent outline-none text-xs w-24"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              placeholder="Target date"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
          {createProject.isError ? (
            <p className="text-xs text-destructive">Failed to create project.</p>
          ) : (
            <span />
          )}
          <Button size="sm" disabled={!name.trim() || createProject.isPending} onClick={handleSubmit}>
            {createProject.isPending ? "Creating…" : "Create project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
