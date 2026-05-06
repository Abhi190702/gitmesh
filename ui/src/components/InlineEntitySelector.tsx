import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "../lib/utils";

export interface InlineEntityOption {
  id: string;
  label: string;
  searchText?: string;
}

interface InlineEntitySelectorProps {
  value: string;
  options: InlineEntityOption[];
  placeholder: string;
  noneLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onChange: (id: string) => void;
  onConfirm?: () => void;
  className?: string;
  renderTriggerValue?: (option: InlineEntityOption | null) => ReactNode;
  renderOption?: (option: InlineEntityOption, isSelected: boolean) => ReactNode;
  /** Skip the Portal so the popover stays in the DOM tree (fixes scroll inside Dialogs). */
  disablePortal?: boolean;
}

/**
 * Inline popover selector for picking an entity from a searchable list.
 * Used for assigning issues, milestones, agents, etc.
 */
export const InlineEntitySelector = forwardRef<HTMLButtonElement, InlineEntitySelectorProps>(
  function InlineEntitySelector(
    {
      value,
      options,
      placeholder,
      noneLabel,
      searchPlaceholder,
      emptyMessage,
      onChange,
      onConfirm,
      className,
      renderTriggerValue,
      renderOption,
      disablePortal,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const searchRef = useRef<HTMLInputElement>(null);
    const preventCloseAutoFocusRef = useRef(false);
    const pointerDownRef = useRef(false);

    // Prepend the "None" option to the list
    const allOptions = useMemo<InlineEntityOption[]>(
      () => [{ id: "", label: noneLabel, searchText: noneLabel }, ...options],
      [noneLabel, options],
    );

    const matches = useMemo(() => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return allOptions;
      return allOptions.filter((opt) =>
        `${opt.label} ${opt.searchText ?? ""}`.toLowerCase().includes(q),
      );
    }, [allOptions, searchTerm]);

    const selectedOption = options.find((opt) => opt.id === value) ?? null;

    // Reset active index when dropdown opens or search changes
    useEffect(() => {
      if (!open) return;
      const idx = matches.findIndex((opt) => opt.id === value);
      setActiveIndex(idx >= 0 ? idx : 0);
    }, [matches, open, value]);

    const select = (idx: number, advance: boolean) => {
      const opt = matches[idx] ?? matches[0];
      if (opt) onChange(opt.id);
      preventCloseAutoFocusRef.current = advance;
      setOpen(false);
      setSearchTerm("");
      if (advance && onConfirm) {
        requestAnimationFrame(() => onConfirm());
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => (matches.length === 0 ? 0 : i <= 0 ? matches.length - 1 : i - 1));
          break;
        case "Enter":
          e.preventDefault();
          select(activeIndex, true);
          break;
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            select(activeIndex, true);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    };

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearchTerm("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
            onPointerDown={() => { pointerDownRef.current = true; }}
            onFocus={() => {
              if (!pointerDownRef.current) setOpen(true);
              pointerDownRef.current = false;
            }}
          >
            {renderTriggerValue
              ? renderTriggerValue(selectedOption)
              : (selectedOption?.label ?? <span className="text-muted-foreground">{placeholder}</span>)}
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={16}
          className="w-[min(20rem,calc(100vw-2rem))] p-1"
          disablePortal={disablePortal}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            // Avoid virtual keyboard on touch devices
            if (!window.matchMedia("(pointer: coarse)").matches) {
              searchRef.current?.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            if (!preventCloseAutoFocusRef.current) return;
            event.preventDefault();
            preventCloseAutoFocusRef.current = false;
          }}
        >
          <input
            ref={searchRef}
            className="w-full border-b border-border bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="max-h-56 overflow-y-auto overscroll-contain py-1 touch-pan-y gitmesh-scrollbar">
            {matches.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-muted-foreground text-center">{emptyMessage}</p>
            ) : (
              matches.map((opt, idx) => {
                const isChosen = opt.id === value;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={opt.id || "__none__"}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm touch-manipulation transition-colors",
                      isActive && "bg-accent/60",
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => select(idx, true)}
                  >
                    {renderOption ? renderOption(opt, isChosen) : <span className="truncate">{opt.label}</span>}
                    <Check
                      className={cn(
                        "ml-auto h-3.5 w-3.5 shrink-0 text-primary transition-opacity",
                        isChosen ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
