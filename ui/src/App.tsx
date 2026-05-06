import { useEffect, useRef } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./features/OnboardingWizard";
import { authApi } from "./api/auth";
import { healthApi } from "./api/health";
import { Dashboard } from "./views/board/Dashboard";
import { Projects } from "./views/general/Projects";
import { Agents } from "./views/agents/Agents";
import { AgentDetail } from "./views/agents/AgentDetail";
import { Subprojects } from "./views/board/Subprojects";
import { SubprojectDetail } from "./views/board/SubprojectDetail";
import { Issues } from "./views/board/Issues";
import { IssueDetail } from "./views/board/IssueDetail";
import { PRs } from "./views/board/PRs";
import { PRDetail } from "./views/board/PRDetail";
import { Milestones } from "./views/board/Milestones";
import { MilestoneDetail } from "./views/board/MilestoneDetail";
import { Approvals } from "./views/general/Approvals";
import { ApprovalDetail } from "./views/general/ApprovalDetail";
import { Costs } from "./views/settings/Costs";
import { AuditLog } from "./views/settings/AuditLog";
import { Policies } from "./views/settings/Policies";
import { Secrets } from "./views/settings/Secrets";
import { Assets } from "./views/settings/Assets";
import { InstanceSettings } from "./views/settings/InstanceSettings";
import { Inbox } from "./views/board/Inbox";
import { ProjectSettings } from "./views/settings/ProjectSettings";
import { DesignGuide } from "./views/general/DesignGuide";
import { TemplateRegistry } from "./views/general/TemplateRegistry";
import { OrgChart } from "./views/agents/OrgChart";
import { EnableAgent } from "./views/agents/EnableAgent";
import { AuthPage } from "./views/access/Auth";
import { BoardClaimPage } from "./views/access/BoardClaim";
import { InviteLandingPage } from "./views/access/InviteLanding";
import { queryKeys } from "./lib/queryKeys";
import { useProject } from "./context/ProjectContext";
import { useDialog } from "./context/DialogContext";

function BootstrapPendingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl items-center px-6 py-10">
      <div className="w-full">
        <p className="eyebrow mb-3">Instance not bootstrapped</p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Setup required</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          No instance admin exists yet. Run this command in your GitMesh Agents environment to generate the first admin invite URL.
        </p>
        <pre className="mt-5 overflow-x-auto rounded-md border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground">
          {`pnpm gitmesh-agents auth bootstrap-admin`}
        </pre>
      </div>
    </div>
  );
}

function CloudAccessGate() {
  const location = useLocation();
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
  });

  if (healthQuery.isLoading || (isAuthenticatedMode && sessionQuery.isLoading)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-primary gm-pulse-dot" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Loading workspace</p>
        </div>
      </div>
    );
  }

  if (healthQuery.error) {
    return (
      <div className="mx-auto max-w-xl py-10 text-sm text-destructive">
        {healthQuery.error instanceof Error ? healthQuery.error.message : "Failed to load app state"}
      </div>
    );
  }

  if (isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending") {
    return <BootstrapPendingPage />;
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  return <Outlet />;
}

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="projects" element={<Projects />} />
      <Route path="project/settings" element={<ProjectSettings />} />
      <Route path="org" element={<OrgChart />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Agents />} />
      <Route path="agents/active" element={<Agents />} />
      <Route path="agents/paused" element={<Agents />} />
      <Route path="agents/error" element={<Agents />} />
      <Route path="agents/new" element={<EnableAgent />} />
      <Route path="agents/enable" element={<EnableAgent />} />
      <Route path="agents/:agentId" element={<AgentDetail />} />
      <Route path="agents/:agentId/:tab" element={<AgentDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<AgentDetail />} />
      <Route path="subprojects" element={<Subprojects />} />
      <Route path="subprojects/:subprojectId" element={<SubprojectDetail />} />
      <Route path="subprojects/:subprojectId/overview" element={<SubprojectDetail />} />
      <Route path="subprojects/:subprojectId/issues" element={<SubprojectDetail />} />
      <Route path="subprojects/:subprojectId/issues/:filter" element={<SubprojectDetail />} />
      <Route path="issues" element={<Issues />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<IssueDetail />} />
      <Route path="prs" element={<PRs />} />
      <Route path="prs/:prId" element={<PRDetail />} />
      <Route path="milestones" element={<Milestones />} />
      <Route path="milestones/:milestoneId" element={<MilestoneDetail />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Approvals />} />
      <Route path="approvals/all" element={<Approvals />} />
      <Route path="approvals/:approvalId" element={<ApprovalDetail />} />
      <Route path="costs" element={<Costs />} />
      <Route path="audit" element={<AuditLog />} />
      <Route path="policies" element={<Policies />} />
      <Route path="secrets" element={<Secrets />} />
      <Route path="assets" element={<Assets />} />
      <Route path="instance-settings" element={<InstanceSettings />} />
      <Route path="inbox" element={<Navigate to="/inbox/new" replace />} />
      <Route path="inbox/new" element={<Inbox />} />
      <Route path="inbox/all" element={<Inbox />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="templates" element={<TemplateRegistry />} />
    </>
  );
}

function ProjectRootRedirect() {
  const { projects, selectedProject, selectedProjectId, loading } = useProject();
  const { onboardingOpen } = useDialog();

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-primary gm-pulse-dot" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Loading workspace</p>
        </div>
      </div>
    );
  }

  // Keep the first-run onboarding mounted until it completes.
  if (onboardingOpen) {
    return <NoProjectsStartPage autoOpen={false} />;
  }

  // Prefer selectedProject (from context, set by URL or localStorage).
  // Fall back to: (a) the project matching selectedProjectId from localStorage, or (b) first project.
  const storedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null;
  const targetProject = selectedProject ?? storedProject ?? projects[0] ?? null;
  if (!targetProject) {
    return <NoProjectsStartPage />;
  }

  return <Navigate to={`/${targetProject.issuePrefix}/dashboard`} replace />;
}

function UnprefixedBoardRedirect() {
  const location = useLocation();
  const { projects, selectedProject, selectedProjectId, loading } = useProject();

  if (loading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-primary gm-pulse-dot" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Loading workspace</p>
        </div>
      </div>
    );
  }

  const storedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null;
  const targetProject = selectedProject ?? storedProject ?? projects[0] ?? null;
  if (!targetProject) {
    return <NoProjectsStartPage />;
  }

  return (
    <Navigate
      to={`/${targetProject.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function NoProjectsStartPage({ autoOpen = true }: { autoOpen?: boolean }) {
  const { openOnboarding } = useDialog();
  const opened = useRef(false);

  useEffect(() => {
    if (!autoOpen) return;
    if (opened.current) return;
    opened.current = true;
    openOnboarding();
  }, [autoOpen, openOnboarding]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-6 py-14">
      <div className="w-full space-y-3">
        <p className="text-xs font-medium text-muted-foreground">GitMesh</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          No workspaces yet
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Add a project to unlock the board, agents, forge sync, policies, and the activity log.
        </p>
        <div className="pt-4">
          <Button className="rounded-xl px-5" onClick={() => openOnboarding()}>
            Start setup
          </Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<BoardClaimPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />

        <Route element={<CloudAccessGate />}>
          <Route index element={<ProjectRootRedirect />} />
          <Route path="projects/*" element={<UnprefixedBoardRedirect />} />
          <Route path="issues" element={<UnprefixedBoardRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedBoardRedirect />} />
          <Route path="prs" element={<UnprefixedBoardRedirect />} />
          <Route path="prs/:prId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/new" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/enable" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedBoardRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedBoardRedirect />} />
          <Route path="subprojects" element={<UnprefixedBoardRedirect />} />
          <Route path="subprojects/:subprojectId" element={<UnprefixedBoardRedirect />} />
          <Route path="subprojects/:subprojectId/overview" element={<UnprefixedBoardRedirect />} />
          <Route path="subprojects/:subprojectId/issues" element={<UnprefixedBoardRedirect />} />
          <Route path="subprojects/:subprojectId/issues/:filter" element={<UnprefixedBoardRedirect />} />
          <Route path="milestones" element={<UnprefixedBoardRedirect />} />
          <Route path="milestones/:milestoneId" element={<UnprefixedBoardRedirect />} />
          <Route path="audit" element={<UnprefixedBoardRedirect />} />
          <Route path="policies" element={<UnprefixedBoardRedirect />} />
          <Route path="templates" element={<UnprefixedBoardRedirect />} />
          <Route path="secrets" element={<UnprefixedBoardRedirect />} />
          <Route path="assets" element={<UnprefixedBoardRedirect />} />
          <Route path="instance-settings" element={<UnprefixedBoardRedirect />} />
          <Route path=":projectPrefix" element={<Layout />}>
              <Route path="projects/:projectId/*" element={<SubprojectDetail />} />
            {boardRoutes()}
          </Route>
        </Route>
      </Routes>
      <OnboardingWizard />
    </>
  );
}
