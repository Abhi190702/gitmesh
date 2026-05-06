import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-[2.75rem]">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">
            {description}
            {meta && (
              <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                · {meta}
              </span>
            )}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
