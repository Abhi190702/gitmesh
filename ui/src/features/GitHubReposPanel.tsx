import { ExternalLink, RefreshCw, Github, AlertCircle, Plug } from "lucide-react";
import type { Project } from "@gitmesh/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";

interface GitHubReposPanelProps {
  project: Project;
}

export function GitHubReposPanel({ project }: GitHubReposPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  if (!project.forgeOwner || !project.forgeRepo) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-dashed border-border bg-surface-2/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-3 text-text-tertiary">
            <Plug className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-text-tertiary">
              Forge
            </p>
            <p className="text-sm text-foreground">No GitHub repository connected.</p>
          </div>
        </div>
        {project.issuePrefix ? (
          <a
            href={`/${project.issuePrefix}/project/settings`}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground underline decoration-text-tertiary underline-offset-4 hover:decoration-primary"
          >
            Connect →
          </a>
        ) : (
          <span className="font-mono text-[10px] tracking-wide text-text-tertiary italic">
            project prefix pending
          </span>
        )}
      </div>
    );
  }

  const repoUrl = `https://github.com/${project.forgeOwner}/${project.forgeRepo}`;
  const lastSynced = project.lastSyncedAt
    ? new Date(project.lastSyncedAt).toLocaleString()
    : "Never";

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await api.post(`/projects/${project.id}/sync`, {});
    } catch {
      setSyncError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-foreground">
            <Github className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-text-tertiary">
              Forge
            </p>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-sm font-medium text-foreground hover:text-primary"
            >
              <span className="truncate">{project.forgeOwner}/{project.forgeRepo}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-text-tertiary" />
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
            Synced · {lastSynced === "Never" ? "never" : lastSynced}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing" : "Sync"}
          </Button>
        </div>
      </div>
      {syncError && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {syncError}
        </div>
      )}
    </div>
  );
}
