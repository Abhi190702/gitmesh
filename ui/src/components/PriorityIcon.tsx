import { useState, type FC } from "react";
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { priorityColor, priorityColorDefault } from "../lib/status-colors";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface PriorityLevel {
  icon: FC<{ className?: string }>;
  colorClass: string;
  displayName: string;
}

const PRIORITIES: Record<string, PriorityLevel> = {
  critical: { icon: AlertTriangle, colorClass: priorityColor.critical ?? priorityColorDefault, displayName: "Critical" },
  high: { icon: ArrowUp, colorClass: priorityColor.high ?? priorityColorDefault, displayName: "High" },
  medium: { icon: Minus, colorClass: priorityColor.medium ?? priorityColorDefault, displayName: "Medium" },
  low: { icon: ArrowDown, colorClass: priorityColor.low ?? priorityColorDefault, displayName: "Low" },
};

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

interface PriorityIconProps {
  priority: string;
  onChange?: (priority: string) => void;
  className?: string;
  showLabel?: boolean;
}

/**
 * Priority indicator with optional inline picker popover.
 */
export function PriorityIcon({ priority, onChange, className, showLabel }: PriorityIconProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const level = PRIORITIES[priority] ?? PRIORITIES.medium!;
  const IconComponent = level.icon;

  const indicator = (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        level.colorClass,
        onChange && !showLabel && "cursor-pointer",
        className,
      )}
    >
      <IconComponent className="h-3.5 w-3.5" />
    </span>
  );

  // Read-only mode
  if (!onChange) {
    return showLabel ? (
      <span className="inline-flex items-center gap-1.5">
        {indicator}
        <span className="text-sm">{level.displayName}</span>
      </span>
    ) : indicator;
  }

  // Editable trigger
  const trigger = showLabel ? (
    <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/40 rounded-md px-1.5 -mx-1 py-0.5 transition-colors">
      {indicator}
      <span className="text-sm">{level.displayName}</span>
    </button>
  ) : indicator;

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {PRIORITY_ORDER.map((key) => {
          const p = PRIORITIES[key]!;
          const PIcon = p.icon;
          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start gap-2 text-xs",
                key === priority && "bg-primary/10 text-primary",
              )}
              onClick={() => {
                onChange(key);
                setPickerOpen(false);
              }}
            >
              <PIcon className={cn("h-3.5 w-3.5", p.colorClass)} />
              {p.displayName}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
