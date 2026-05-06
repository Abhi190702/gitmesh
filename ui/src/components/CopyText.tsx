import { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyTextProps {
  text: string;
  /** What to display. Defaults to `text`. */
  children?: React.ReactNode;
  className?: string;
  /** Tooltip message shown after copying. Default: "Copied!" */
  copiedLabel?: string;
}

/**
 * Inline copy-to-clipboard widget with a check icon confirmation.
 */
export function CopyText({ text, children, className, copiedLabel = "Copied!" }: CopyTextProps) {
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setErrorMsg(null);
    } catch {
      setErrorMsg("Copy failed");
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      setErrorMsg(null);
    }, 1800);
  }, [text]);

  return (
    <span className="group/copy relative inline-flex items-center gap-1">
      <button
        type="button"
        className={cn(
          "cursor-copy transition-colors hover:text-foreground",
          className,
        )}
        onClick={handleCopy}
        aria-label={`Copy: ${text}`}
      >
        {children ?? text}
      </button>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] transition-opacity duration-200",
          copied || errorMsg ? "opacity-100" : "opacity-0",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">{copiedLabel}</span>
          </>
        ) : errorMsg ? (
          <span className="text-destructive">{errorMsg}</span>
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover/copy:opacity-60" />
        )}
      </span>
    </span>
  );
}
