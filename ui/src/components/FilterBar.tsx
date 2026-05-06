import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterValue {
  key: string;
  label: string;
  value: string;
}

interface FilterBarProps {
  filters: FilterValue[];
  onRemove: (key: string) => void;
  onClear: () => void;
}

/**
 * Active filter chips bar with individual remove and clear-all.
 */
export function FilterBar({ filters, onRemove, onClear }: FilterBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((f) => (
        <span
          key={f.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground",
          )}
        >
          <span className="text-muted-foreground">{f.label}:</span>
          <span>{f.value}</span>
          <button
            className="ml-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
            onClick={() => onRemove(f.key)}
            aria-label={`Remove ${f.label} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" className="text-xs h-6 text-muted-foreground" onClick={onClear}>
          Clear all
        </Button>
      )}
    </div>
  );
}
