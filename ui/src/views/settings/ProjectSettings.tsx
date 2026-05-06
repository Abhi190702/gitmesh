import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProject } from "../../context/ProjectContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { projectsApi } from "../../api/projects-api";
import { accessApi } from "../../api/access";
import { authApi } from "../../api/auth";
import { githubApi, type GitHubRepo } from "../../api/github";
import { forgeApi, type ForgeWebhook } from "../../api/forge";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Settings, Check, Github, Webhook, RefreshCw, Trash2, Zap, RotateCw, Search, Lock, Loader2, ExternalLink } from "lucide-react";
import { ProjectPatternIcon } from "../../components/ProjectPatternIcon";
import { Field, ToggleField, HintIcon } from "../../components/agent-config-primitives";

// ── Helper functions ─────────────────────────────────────────────────────

function maskSecret(secret: string): string {
  if (secret.length <= 13) return secret;
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

function buildInviteSnippet(input: {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
  testResolutionUrl?: string | null;
}) {
  const candidateUrls = buildCandidateUrls(input);
  const resolutionTestUrl = buildTestResolutionUrl(input);

  const urlList = candidateUrls.length > 0 ? candidateUrls.map((u) => `- ${u}`).join("\n") : "- (No candidate URLs available yet.)";

  const connectivityGuidance = candidateUrls.length === 0
    ? `No candidate URLs are available. Ask your user to configure a reachable hostname in GitMesh Agents, then retry.
Suggested steps:
- choose a hostname that resolves to the GitMesh Agents host from your runtime
- run: pnpm gitmesh-agents allowed-hostname <host>
- restart GitMesh Agents
- verify with: curl -fsS http://<host>:3100/api/health
- regenerate this invite snippet`
    : `If none are reachable, ask your user to add a reachable hostname in GitMesh Agents, restart, and retry.
Suggested command:
- pnpm gitmesh-agents allowed-hostname <host>
Then verify with: curl -fsS <base-url>/api/health`;

  const resolutionLine = resolutionTestUrl
    ? `\nYou MUST test GitMesh Agents-to-gateway reachability, call: ${resolutionTestUrl}?url=<urlencoded-gateway-url> (using the hostname that worked above). Do not assume your 172.x is necessarily reachable from GitMesh Agents. Test it. `
    : "";

  return `You're invited to join a GitMesh Agents organization.

The URLs you should try are:
${urlList}

Connectivity guidance:
If you are running on a different machine than GitMesh Agents, GitMesh Agents must be reachable at one of the hostnames used above.
Verify the hostname works from your runtime with: GET <base-url>/api/health

${connectivityGuidance}

For your "agentName", just use your own agent name and send it directly.
You also need to send a gateway URL that GitMesh Agents can access. Check your config and include that URL.${resolutionLine}

---

This onboarding flow is for Gateway.
When you submit the join request, use:
- \`adapterType: "gateway"\`
- \`agentDefaultsPayload.url\` as your \`ws://\` or \`wss://\` gateway URL
- \`agentDefaultsPayload.headers["x-gateway-token"]\` with your gateway token
- (legacy accepted) \`agentDefaultsPayload.headers["x-gateway-auth"]\`
- Keep device auth enabled (recommended). If \`devicePrivateKeyPem\` is omitted, GitMesh Agents will generate and persist one during join so pairing approvals remain stable.
- Only use \`disableDeviceAuth=true\` for special environments where pairing cannot be completed.

Do NOT use \`/v1/responses\` or \`/hooks/*\` in this join flow.

Before you do anything, please respond to your user that you understand the instructions and you're going to work on them. Then do the step above in another session called "gitmesh-agents-onboarding" and then tell your user when you're done. Update your user in intermediate steps along the way so they know what's going on.

Then after you've connected to GitMesh Agents (exchanged keys etc.) you MUST review and follow the onboarding instructions in onboarding.txt they give you.

`;
}

function buildCandidateUrls(input: {
  onboardingTextUrl: string;
  connectionCandidates?: string[] | null;
}): string[] {
  const candidates = (input.connectionCandidates ?? []).map((c) => c.trim()).filter(Boolean);
  const urls = new Set<string>();
  let baseUrl: URL | null = null;

  try {
    baseUrl = new URL(input.onboardingTextUrl);
    urls.add(baseUrl.toString());
  } catch {
    const trimmed = input.onboardingTextUrl.trim();
    if (trimmed) urls.add(trimmed);
  }

  if (!baseUrl) {
    for (const candidate of candidates) urls.add(candidate);
    return Array.from(urls);
  }

  const onboardingPath = `${baseUrl.pathname}${baseUrl.search}`;
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      urls.add(`${parsed.origin}${onboardingPath}`);
    } catch {
      urls.add(candidate);
    }
  }

  return Array.from(urls);
}

function buildTestResolutionUrl(input: {
  onboardingTextUrl: string;
  testResolutionUrl?: string | null;
}): string | null {
  const explicit = input.testResolutionUrl?.trim();
  if (explicit) return explicit;
  try {
    const parsed = new URL(input.onboardingTextUrl);
    const testPath = parsed.pathname.replace(/\/onboarding\.txt$/, "/test-resolution");
    return `${parsed.origin}${testPath}`;
  } catch {
    return null;
  }
}

// ── Webhook list item ──────────────────────────────────────────────────

function WebhookItem({
  webhook,
  onTest,
  onDelete,
  onRotate,
  isTesting,
  isDeleting,
  isRotating,
}: {
  webhook: ForgeWebhook;
  onTest: () => void;
  onDelete: () => void;
  onRotate: () => void;
  isTesting: boolean;
  isDeleting: boolean;
  isRotating: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${webhook.active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
          <span className="text-sm">
            {webhook.forgeProvider === "github" ? "GitHub" : webhook.forgeProvider} webhook
          </span>
          {webhook.forgeWebhookId && (
            <span className="text-xs text-muted-foreground font-mono">#{webhook.forgeWebhookId}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" title="Test webhook" onClick={onTest} disabled={isTesting}>
            <Zap className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" title="Remove webhook" onClick={onDelete} disabled={isDeleting} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(webhook.events as string[]).map((evt) => (
          <span key={evt} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{evt}</span>
        ))}
      </div>

      {webhook.lastDeliveredAt && (
        <p className="text-xs text-muted-foreground">
          Last delivery: {new Date(webhook.lastDeliveredAt).toLocaleString()}
          {webhook.deliveryStatus === "failed" && webhook.lastError && (
            <span className="ml-1 text-destructive">({webhook.lastError})</span>
          )}
        </p>
      )}
      {webhook.deliveryStatus && webhook.deliveryStatus !== "received" && webhook.deliveryStatus !== "processed" && (
        <p className="text-xs text-muted-foreground">Status: {webhook.deliveryStatus}</p>
      )}

      {webhook.webhookSecret && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{maskSecret(webhook.webhookSecret)}</span>
          <Button size="sm" variant="ghost" title="Rotate webhook secret" onClick={onRotate} disabled={isRotating} className="h-6 px-1.5 text-xs">
            <RotateCw className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function ProjectSettings() {
  const { projects, selectedProject, selectedProjectId, setSelectedProjectId } = useProject();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  // General settings state
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [brandColor, setBrandColor] = useState("");

  // Sync from selected project
  useEffect(() => {
    if (!selectedProject) return;
    setProjectName(selectedProject.name);
    setDescription(selectedProject.description ?? "");
    setBrandColor(selectedProject.brandColor ?? "");
  }, [selectedProject]);

  // Invite state
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSnippet, setInviteSnippet] = useState<string | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyId, setSnippetCopyId] = useState(0);

  // GitHub state
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // Webhook rotate dialog
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<ForgeWebhook | null>(null);

  const { pushToast } = useToast();

  // Derived state
  const generalDirty = !!selectedProject && (
    projectName !== selectedProject.name ||
    description !== (selectedProject.description ?? "") ||
    brandColor !== (selectedProject.brandColor ?? "")
  );

  // Queries
  const webhooksQuery = useQuery({
    queryKey: ["forge", "webhooks", selectedProjectId],
    queryFn: () => forgeApi.getWebhookStatus(selectedProjectId!),
    enabled: !!selectedProjectId,
    refetchInterval: 30_000,
  });

  // Mutations
  const generalMutation = useMutation({
    mutationFn: (data: { name: string; description: string | null; brandColor: string | null }) =>
      projectsApi.update(selectedProjectId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });

  const settingsMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      projectsApi.update(selectedProjectId!, { requireOperatorApprovalForNewAgents: requireApproval }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });

  const inviteMutation = useMutation({
    mutationFn: () => accessApi.createGatewayInvitePrompt(selectedProjectId!),
    onSuccess: async (invite) => {
      setInviteError(null);
      const base = window.location.origin.replace(/\/+$/, "");
      const onboardingLink = invite.onboardingTextUrl ?? invite.onboardingTextPath ?? `/api/invites/${invite.token}/onboarding.txt`;
      const absoluteUrl = onboardingLink.startsWith("http") ? onboardingLink : `${base}${onboardingLink}`;
      setSnippetCopied(false);
      setSnippetCopyId(0);
      let snippet: string;
      try {
        const manifest = await accessApi.getInviteOnboarding(invite.token);
        snippet = buildInviteSnippet({
          onboardingTextUrl: absoluteUrl,
          connectionCandidates: manifest.onboarding.connectivity?.connectionCandidates ?? null,
          testResolutionUrl: manifest.onboarding.connectivity?.testResolutionEndpoint?.url ?? null,
        });
      } catch {
        snippet = buildInviteSnippet({ onboardingTextUrl: absoluteUrl, connectionCandidates: null, testResolutionUrl: null });
      }
      setInviteSnippet(snippet);
      try {
        await navigator.clipboard.writeText(snippet);
        setSnippetCopied(true);
        setSnippetCopyId((p) => p + 1);
        setTimeout(() => setSnippetCopied(false), 2000);
      } catch { /* clipboard may not be available */ }
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedProjectId!) });
    },
    onError: (err) => setInviteError(err instanceof Error ? err.message : "Failed to create invite"),
  });

  const connectMutation = useMutation({
    mutationFn: (repo: GitHubRepo) => githubApi.connectProject({
      projectId: selectedProjectId!,
      forgeOwner: repo.owner.login,
      forgeRepo: repo.name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      pushToast({ title: "GitHub repository connected", tone: "success" });
    },
  });

  const registerWebhookMutation = useMutation({
    mutationFn: () => {
      if (!selectedProject) throw new Error("No project selected");
      return forgeApi.registerWebhook(selectedProjectId!, {
        forgeProvider: "github",
        forgeOwner: selectedProject.forgeOwner ?? "",
        forgeRepo: selectedProject.forgeRepo ?? "",
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forge", "webhooks", selectedProjectId] }),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => forgeApi.deleteWebhook(selectedProjectId!, webhookId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forge", "webhooks", selectedProjectId] }),
  });

  const testWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => forgeApi.testWebhook(selectedProjectId!, webhookId),
  });

  const rotateWebhookMutation = useMutation({
    mutationFn: ({ webhookId }: { webhookId: string }) => forgeApi.rotateWebhook(selectedProjectId!, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forge", "webhooks", selectedProjectId] });
      setRotateDialogOpen(false);
      setRotateTarget(null);
      pushToast({ title: "Webhook secret rotated", tone: "success" });
    },
    onError: (err) => pushToast({ title: "Failed to rotate secret", body: err instanceof Error ? err.message : "Unknown error", tone: "error" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ projectId, nextProjectId }: { projectId: string; nextProjectId: string | null }) =>
      projectsApi.archive(projectId).then(() => ({ nextProjectId })),
    onSuccess: async ({ nextProjectId }) => {
      if (nextProjectId) setSelectedProjectId(nextProjectId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.stats });
    },
  });

  const githubReposQuery = useQuery({
    queryKey: ["github", "repos", selectedProjectId],
    queryFn: () => githubApi.listRepos(),
    enabled: !!selectedProjectId,
    retry: false,
  });

  // Check if GitHub OAuth is configured on the server
  const githubStatusQuery = useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const filteredRepos = useMemo(() => {
    const repos = githubReposQuery.data ?? [];
    const search = repoSearch.trim().toLowerCase();
    if (!search) return repos;
    return repos.filter((repo) =>
      repo.full_name.toLowerCase().includes(search) ||
      (repo.description ?? "").toLowerCase().includes(search),
    );
  }, [githubReposQuery.data, repoSearch]);

  // Keep repo selection aligned with project connection and repo list refreshes.
  useEffect(() => {
    if (!selectedProject) {
      setSelectedRepo(null);
      return;
    }
    const repos = githubReposQuery.data ?? [];
    if (repos.length === 0) {
      setSelectedRepo(null);
      return;
    }

    const connected = selectedProject.forgeOwner && selectedProject.forgeRepo
      ? repos.find((repo) => repo.full_name === `${selectedProject.forgeOwner}/${selectedProject.forgeRepo}`)
      : null;
    if (connected) {
      setSelectedRepo(connected);
      return;
    }

    setSelectedRepo((current) => {
      if (!current) return null;
      return repos.find((repo) => repo.id === current.id) ?? null;
    });
  }, [selectedProject, githubReposQuery.data]);

  useEffect(() => {
    setRepoSearch("");
  }, [selectedProjectId]);

  const shouldShowGitHubLogin = githubStatusQuery.data?.githubOAuthConfigured === true && githubReposQuery.isError && (() => {
    const msg = githubReposQuery.error instanceof Error ? githubReposQuery.error.message.toLowerCase() : "";
    return msg.includes("no github account linked") || msg.includes("not authenticated") || msg.includes("unauthorized");
  })();

  const callbackPath = `${window.location.pathname}${window.location.search}`;
  const githubLoginHref = `/api/auth/sign-in/github?callbackURL=${encodeURIComponent(callbackPath)}`;
  const connectedRepoFullName = selectedProject?.forgeOwner && selectedProject?.forgeRepo
    ? `${selectedProject.forgeOwner}/${selectedProject.forgeRepo}`
    : null;
  const selectedRepoIsConnected = !!selectedRepo && selectedRepo.full_name === connectedRepoFullName;

  // Reset invite state on project change
  useEffect(() => {
    setInviteError(null);
    setInviteSnippet(null);
    setSnippetCopied(false);
    setSnippetCopyId(0);
  }, [selectedProjectId]);

  useEffect(() => {
    setBreadcrumbs([{ label: selectedProject?.name ?? "Project", href: "/dashboard" }, { label: "Settings" }]);
  }, [setBreadcrumbs, selectedProject?.name]);

  if (!selectedProject) {
    return <div className="text-sm text-muted-foreground">No project selected. Select a project from the switcher above.</div>;
  }

  const handleSaveGeneral = () => {
    generalMutation.mutate({ name: projectName.trim(), description: description.trim() || null, brandColor: brandColor || null });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Project Settings</h1>
      </div>

      {/* General */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">General</div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <Field label="Project name" hint="The display name for your project.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none" type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </Field>
          <Field label="Description" hint="Optional description shown in the project profile.">
            <input className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none" type="text" value={description} placeholder="Optional project description" onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Appearance */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appearance</div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <ProjectPatternIcon projectName={projectName || selectedProject.name} brandColor={brandColor || null} className="rounded-[14px]" />
            </div>
            <div className="flex-1 space-y-2">
              <Field label="Brand color" hint="Sets the hue for the project icon. Leave empty for auto-generated color.">
                <div className="flex items-center gap-2">
                  <input type="color" value={brandColor || "#6366f1"} onChange={(e) => setBrandColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0" />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandColor(v);
                    }}
                    placeholder="Auto"
                    className="w-28 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm font-mono outline-none"
                  />
                  {brandColor && <Button size="sm" variant="ghost" onClick={() => setBrandColor("")} className="text-xs text-muted-foreground">Clear</Button>}
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* Save General + Appearance */}
      {generalDirty && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSaveGeneral} disabled={generalMutation.isPending || !projectName.trim()}>
            {generalMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
          {generalMutation.isSuccess && <span className="text-xs text-muted-foreground">Saved</span>}
          {generalMutation.isError && <span className="text-xs text-destructive">{generalMutation.error instanceof Error ? generalMutation.error.message : "Failed to save"}</span>}
        </div>
      )}

      {/* Agent Governance */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent Governance</div>
        <div className="rounded-md border border-border px-4 py-3">
          <ToggleField
            label="Require approval for enabling agents"
            hint="New agent enables stay pending until approved by a maintainer."
            checked={!!selectedProject.requireOperatorApprovalForNewAgents}
            onChange={(v) => settingsMutation.mutate(v)}
          />
        </div>
      </div>

      {/* GitHub Connection */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Github className="h-3.5 w-3.5" />
          GitHub Connection
        </div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          {selectedProject.forgeProvider === "github" && selectedProject.forgeOwner ? (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-600">Connected: {selectedProject.forgeOwner}/{selectedProject.forgeRepo}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Not connected. Sign in with GitHub and choose a repository.</span>
            </div>
          )}

          {shouldShowGitHubLogin && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground space-y-2">
              <p>GitHub is not linked to your user account yet.</p>
              <Button size="sm" asChild>
                <a href={githubLoginHref}>
                  <Github className="h-3.5 w-3.5" />
                  Login with GitHub
                </a>
              </Button>
            </div>
          )}

          <Field label="Repository" hint="Search and select a repository from your GitHub account.">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full rounded-md border border-border bg-transparent px-8 py-1.5 text-sm outline-none"
                  type="text"
                  placeholder="Search repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  disabled={githubReposQuery.isLoading || githubReposQuery.isError}
                />
              </div>

              <div className="max-h-60 overflow-y-auto rounded-md border border-border">
                {githubReposQuery.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading repositories...
                  </div>
                ) : githubReposQuery.isError ? (
                  <div className="space-y-2 px-3 py-3">
                    <p className="text-xs text-destructive">{githubReposQuery.error instanceof Error ? githubReposQuery.error.message : "Failed to load repositories"}</p>
                    <Button size="sm" variant="ghost" onClick={() => githubReposQuery.refetch()}>Retry</Button>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No repositories found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredRepos.slice(0, 60).map((repo) => {
                      const isSelected = selectedRepo?.id === repo.id;
                      return (
                        <button
                          key={repo.id}
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/40 ${isSelected ? "bg-muted/60" : ""}`}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{repo.full_name}</span>
                            {repo.private && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          </div>
                          {repo.description && <p className="truncate text-xs text-muted-foreground">{repo.description}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Field>

          {connectMutation.isError && <p className="text-sm text-destructive">{connectMutation.error instanceof Error ? connectMutation.error.message : "Failed to connect GitHub"}</p>}

          {selectedRepo && (
            <p className="text-xs text-muted-foreground">
              Selected repo: <span className="font-medium text-foreground">{selectedRepo.full_name}</span>
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => selectedRepo && connectMutation.mutate(selectedRepo)}
              disabled={connectMutation.isPending || !selectedRepo || selectedRepoIsConnected || githubReposQuery.isError}
            >
              {connectMutation.isPending ? "Connecting..." : selectedRepoIsConnected ? "Already Connected" : "Connect Selected Repository"}
            </Button>
            {selectedRepo?.html_url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={selectedRepo.html_url} target="_blank" rel="noreferrer">
                  Open Repo
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>

          {shouldShowGitHubLogin && (
            <p className="text-xs text-muted-foreground">
              After authorizing GitHub, return here and click Retry to load your repositories.
            </p>
          )}

          {!shouldShowGitHubLogin && githubReposQuery.isSuccess && githubReposQuery.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">No repositories are visible for this account.</p>
          )}

          {!githubStatusQuery.data?.githubOAuthConfigured && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
              <p className="text-xs text-yellow-600">
                GitHub OAuth is not configured. Set <code className="bg-muted px-1">GITHUB_CLIENT_ID</code> and <code className="bg-muted px-1">GITHUB_CLIENT_SECRET</code> in your environment to enable GitHub login.
              </p>
            </div>
          )}

          {githubStatusQuery.data?.githubOAuthConfigured && (
            <>
              <Button size="sm" variant="ghost" asChild>
                <a href={githubLoginHref}>
                  <Github className="h-3.5 w-3.5" />
                  Re-auth GitHub
                </a>
              </Button>
              <p className="text-xs text-muted-foreground">If repository access changes, use Re-auth GitHub to refresh permissions.</p>
            </>
          )}

          <Button size="sm" onClick={() => githubReposQuery.refetch()} disabled={githubReposQuery.isFetching}>
            {githubReposQuery.isFetching ? "Refreshing..." : "Refresh Repository List"}
          </Button>
        </div>
      </div>

      {/* Webhooks */}
      {selectedProject.forgeProvider === "github" && selectedProject.forgeOwner && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Webhook className="h-3.5 w-3.5" />
            Webhooks
          </div>
          <div className="space-y-3 rounded-md border border-border px-4 py-4">
            {webhooksQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading webhook status...</p>
            ) : webhooksQuery.isError ? (
              <p className="text-sm text-destructive">Failed to load webhooks.</p>
            ) : webhooksQuery.data && webhooksQuery.data.length > 0 ? (
              <div className="space-y-3">
                {webhooksQuery.data.map((webhook: ForgeWebhook) => (
                  <WebhookItem
                    key={webhook.id}
                    webhook={webhook}
                    onTest={() => testWebhookMutation.mutate(webhook.id)}
                    onDelete={() => deleteWebhookMutation.mutate(webhook.id)}
                    onRotate={() => { setRotateTarget(webhook); setRotateDialogOpen(true); }}
                    isTesting={testWebhookMutation.isPending}
                    isDeleting={deleteWebhookMutation.isPending}
                    isRotating={rotateWebhookMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No webhooks registered. Click below to register one.</p>
            )}

            {registerWebhookMutation.isError && <p className="text-sm text-destructive">{registerWebhookMutation.error instanceof Error ? registerWebhookMutation.error.message : "Failed to register webhook"}</p>}

            <Button size="sm" onClick={() => registerWebhookMutation.mutate()} disabled={registerWebhookMutation.isPending || webhooksQuery.isLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${registerWebhookMutation.isPending ? "animate-spin" : ""}`} />
              {registerWebhookMutation.isPending ? "Registering..." : "Register Webhook"}
            </Button>
          </div>
        </div>
      )}

      {/* Invites */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invites</div>
        <div className="space-y-3 rounded-md border border-border px-4 py-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Generate a gateway agent invite snippet.</span>
            <HintIcon text="Creates a short-lived gateway agent invite and renders a copy-ready prompt." />
          </div>
          <Button size="sm" onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? "Generating..." : "Generate Gateway Invite Prompt"}
          </Button>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
          {inviteSnippet && (
            <div className="rounded-md border border-border bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">Gateway Invite Prompt</div>
                {snippetCopied && (
                  <span key={snippetCopyId} className="flex items-center gap-1 text-xs text-green-600 animate-pulse">
                    <Check className="h-3 w-3" /> Copied
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-1.5">
                <textarea className="h-[28rem] w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none" value={inviteSnippet} readOnly />
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteSnippet);
                      setSnippetCopied(true);
                      setSnippetCopyId((p) => p + 1);
                      setTimeout(() => setSnippetCopied(false), 2000);
                    } catch { /* clipboard may not be available */ }
                  }}>
                    {snippetCopied ? "Copied snippet" : "Copy snippet"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rotate Webhook Secret Dialog */}
      {rotateDialogOpen && rotateTarget && (
        <Dialog open onOpenChange={(open) => { if (!open) { setRotateDialogOpen(false); setRotateTarget(null); } }}>
          <DialogContent className="max-w-sm">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Rotate webhook secret?</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  GitHub may temporarily fail webhook deliveries during rotation. The new secret will be used immediately.
                </p>
                {rotateTarget.webhookSecret && (
                  <p className="mt-2 text-xs text-muted-foreground">Current secret: <span className="font-mono">{maskSecret(rotateTarget.webhookSecret)}</span></p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setRotateDialogOpen(false); setRotateTarget(null); }}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={() => rotateWebhookMutation.mutate({ webhookId: rotateTarget.id })} disabled={rotateWebhookMutation.isPending}>
                  {rotateWebhookMutation.isPending ? "Rotating..." : "Rotate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="text-xs font-medium text-destructive uppercase tracking-wide">Danger Zone</div>
        <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Archive this project to hide it from the sidebar. This persists in the database.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={archiveMutation.isPending || selectedProject.status === "archived"}
              onClick={() => {
                if (!selectedProjectId) return;
                const confirmed = window.confirm(`Archive project "${selectedProject.name}"? It will be hidden from the sidebar.`);
                if (!confirmed) return;
                const nextProjectId = projects.find((p) => p.id !== selectedProjectId && p.status !== "archived")?.id ?? null;
                archiveMutation.mutate({ projectId: selectedProjectId, nextProjectId });
              }}
            >
              {archiveMutation.isPending ? "Archiving..." : selectedProject.status === "archived" ? "Already archived" : "Archive project"}
            </Button>
            {archiveMutation.isError && <span className="text-xs text-destructive">{archiveMutation.error instanceof Error ? archiveMutation.error.message : "Failed to archive project"}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
