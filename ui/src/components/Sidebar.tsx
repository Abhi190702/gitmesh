import { NavLink } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  CircleDot,
  Bot,
  Inbox,
  Settings,
  Search,
  Plus,
  Workflow,
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { useProject } from "../context/ProjectContext";
import { useSidebar } from "../context/SidebarContext";
import { sidebarBadgesApi } from "../api/sidebarBadges";
import { heartbeatsApi } from "../api/heartbeats";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

interface MobileNavItemProps {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  badgeTone?: "default" | "danger";
  liveCount?: number;
}

function MobileNavItem({ to, icon: Icon, label, badge, badgeTone = "default", liveCount }: MobileNavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-transparent text-foreground/72 hover:border-border hover:bg-accent hover:text-foreground",
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {liveCount != null && liveCount > 0 && (
        <span className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{liveCount}</span>
        </span>
      )}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none",
            badgeTone === "danger" ? "bg-red-500 text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { openNewIssue } = useDialog();
  const { selectedProject } = useProject();
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const { setSidebarOpen } = useSidebar();

  const { data: sidebarBadges } = useQuery({
    queryKey: queryKeys.sidebarBadges(selectedProjectId!),
    queryFn: () => sidebarBadgesApi.get(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedProjectId!),
    queryFn: () => heartbeatsApi.liveRunsForProject(selectedProjectId!),
    enabled: !!selectedProjectId,
    refetchInterval: 10_000,
  });

  const liveRunCount = liveRuns?.length ?? 0;
  const inboxCount = sidebarBadges?.inbox ?? 0;
  const approvalCount = sidebarBadges?.approvals ?? 0;

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    setSidebarOpen(false);
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{selectedProject?.name ?? "GitMesh"}</p>
            {selectedProject?.issuePrefix && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {selectedProject.issuePrefix}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <MobileNavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" liveCount={liveRunCount} />
        <MobileNavItem to="/issues" icon={CircleDot} label="Issues" />
        <MobileNavItem to="/agents/all" icon={Bot} label="Agents" />
        <MobileNavItem
          to="/inbox"
          icon={Inbox}
          label="Inbox"
          badge={inboxCount}
          badgeTone={inboxCount > 0 ? "danger" : "default"}
        />

        <div className="my-2 h-px bg-border" />

        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
          Search
        </button>

        <button
          type="button"
          onClick={() => { openNewIssue(); setSidebarOpen(false); }}
          className="flex w-full items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          New Issue
        </button>

        <div className="my-2 h-px bg-border" />

        {approvalCount > 0 && (
          <MobileNavItem
            to="/approvals"
            icon={Inbox}
            label={`Approvals`}
            badge={approvalCount}
            badgeTone="danger"
          />
        )}

        <MobileNavItem to="/instance-settings" icon={Settings} label="Settings" />
      </nav>
    </aside>
  );
}
