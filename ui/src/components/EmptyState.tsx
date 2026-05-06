import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  secondary?: ReactNode;
  eyebrow?: string;
}

export function EmptyState({
  icon: Icon,
  message,
  description,
  action,
  onAction,
  secondary,
  eyebrow,
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-2xl" />
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </div>
      </div>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h3 className="text-2xl font-semibold leading-tight text-foreground">{message}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {action && onAction && (
        <Button onClick={onAction} size="sm" className="mt-5 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {action}
        </Button>
      )}
      {secondary && <div className="mt-3">{secondary}</div>}
    </div>
  );
}
