import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Colored pill badge displaying an issue/task status.
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 tracking-wide",
        statusBadge[status] ?? statusBadgeDefault,
        className,
      )}
    >
      {label}
    </span>
  );
}
