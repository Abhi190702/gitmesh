import { NavLink } from "@/lib/router";
import { cn } from "../lib/utils";
import { useSidebar } from "../context/SidebarContext";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  className?: string;
  badge?: number;
  badgeTone?: "default" | "danger";
  alert?: boolean;
  liveCount?: number;
}

export function SidebarNavItem({
  to,
  label,
  icon: Icon,
  end,
  className,
  badge,
  badgeTone = "default",
  alert = false,
  liveCount,
}: SidebarNavItemProps) {
  const { isMobile, setSidebarOpen } = useSidebar();

  return (
    <NavLink
      to={to}
      end={end}
      onClick={() => { if (isMobile) setSidebarOpen(false); }}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-[13px] font-medium transition-all",
          isActive
            ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_16px_32px_-24px_color-mix(in_oklab,var(--primary)_85%,transparent)]"
            : "border-transparent bg-transparent text-foreground/72 hover:border-white/8 hover:bg-background/72 hover:text-foreground",
          className,
        )
      }
    >
      <span
        className={cn(
          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
          "bg-background/80 text-muted-foreground group-hover:bg-accent group-hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {alert && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_2px_hsl(var(--background))]" />
        )}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {liveCount != null && liveCount > 0 && (
        <span className="ml-auto flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            {liveCount}
          </span>
        </span>
      )}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "ml-auto min-w-[20px] rounded-full px-2 py-0.5 text-center text-[10px] font-semibold leading-none",
            badgeTone === "danger"
              ? "bg-red-500/15 text-red-600 dark:text-red-400"
              : "bg-background/80 text-primary",
          )}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}
