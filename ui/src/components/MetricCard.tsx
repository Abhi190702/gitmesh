import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div
      className={`group relative flex h-full flex-col justify-between rounded-md border border-border bg-card px-4 py-4 transition-colors${
        isClickable ? " hover:border-border-strong" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.20em] text-text-tertiary">
          {label}
        </p>
        <Icon className="h-3.5 w-3.5 text-text-tertiary/60" strokeWidth={1.6} />
      </div>
      <div className="mt-3">
        <p className="text-3xl font-semibold leading-none tracking-tight text-foreground tabular-nums md:text-4xl">
          {value}
        </p>
        {description && (
          <div className="mt-2 text-xs text-text-secondary">{description}</div>
        )}
      </div>
      {isClickable && (
        <ArrowUpRight className="absolute right-3 bottom-3 h-3.5 w-3.5 text-text-tertiary/0 transition-all group-hover:text-text-tertiary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full block" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
