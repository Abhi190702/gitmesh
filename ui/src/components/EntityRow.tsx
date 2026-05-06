import { type ReactNode } from "react";
import { Link } from "@/lib/router";
import { cn } from "../lib/utils";

interface EntityRowProps {
  leading?: ReactNode;
  identifier?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  selected?: boolean;
  to?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Unified entity row with hover accent border and selection state.
 */
export function EntityRow({
  leading,
  identifier,
  title,
  subtitle,
  trailing,
  selected,
  to,
  onClick,
  className,
}: EntityRowProps) {
  const isInteractive = !!(to || onClick);
  const rowClasses = cn(
    "relative flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
    isInteractive && "cursor-pointer hover:bg-surface-2/60",
    selected && "bg-primary/5",
    className,
  );

  const inner = (
    <>
      {selected && <span aria-hidden className="absolute inset-y-1 left-0 w-[2px] rounded-r-full bg-primary" />}
      {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {identifier && (
            <span className="text-[11px] text-text-tertiary font-mono shrink-0 tabular-nums">
              {identifier}
            </span>
          )}
          <span className="truncate text-foreground">{title}</span>
        </div>
        {subtitle && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0 ml-auto">{trailing}</div>}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(rowClasses, "no-underline text-inherit")} onClick={onClick}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={rowClasses} onClick={onClick} role={isInteractive ? "button" : undefined}>
      {inner}
    </div>
  );
}
