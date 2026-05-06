import { useState } from "react";
import { cn } from "../lib/utils";
import { issueStatusIcon, issueStatusIconDefault } from "../lib/status-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"] as const;

function formatStatus(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

interface StatusIconProps {
  status: string;
  onChange?: (status: string) => void;
  className?: string;
  showLabel?: boolean;
}

/**
 * Circular status indicator with optional inline picker.
 */
export function StatusIcon({ status, onChange, className, showLabel }: StatusIconProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const colorClass = issueStatusIcon[status] ?? issueStatusIconDefault;
  const completed = status === "done";
  const label = formatStatus(status);

  const dot = (
    <span
      className={cn(
        "relative inline-flex h-4 w-4 rounded-full border-2 shrink-0 transition-colors",
        colorClass,
        onChange && !showLabel && "cursor-pointer",
        className,
      )}
    >
      {completed && (
        <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-current" />
      )}
    </span>
  );

  // Read-only
  if (!onChange) {
    return showLabel ? (
      <span className="inline-flex items-center gap-1.5">
        {dot}
        <span className="text-sm">{label}</span>
      </span>
    ) : dot;
  }

  // Editable
  const trigger = showLabel ? (
    <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/40 rounded-md px-1.5 -mx-1 py-0.5 transition-colors">
      {dot}
      <span className="text-sm">{label}</span>
    </button>
  ) : dot;

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {STATUS_ORDER.map((key) => (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            className={cn(
              "w-full justify-start gap-2 text-xs",
              key === status && "bg-primary/10 text-primary",
            )}
            onClick={() => {
              onChange(key);
              setPickerOpen(false);
            }}
          >
            <StatusIcon status={key} />
            {formatStatus(key)}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
