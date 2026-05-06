import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { X } from "lucide-react";
import { useToast, type ToastItem, type ToastTone } from "../context/ToastContext";
import { cn } from "../lib/utils";

/** Accent color map per toast tone. */
const TONE_STYLES: Record<ToastTone, { container: string; dot: string }> = {
  info: {
    container: "border-sky-400/30 bg-sky-50/90 text-sky-900 dark:border-sky-500/20 dark:bg-sky-950/70 dark:text-sky-100",
    dot: "bg-sky-500 dark:bg-sky-400",
  },
  success: {
    container: "border-emerald-400/30 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-100",
    dot: "bg-emerald-500 dark:bg-emerald-400",
  },
  warn: {
    container: "border-amber-400/30 bg-amber-50/90 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/70 dark:text-amber-100",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
  error: {
    container: "border-red-400/30 bg-red-50/90 text-red-900 dark:border-red-500/20 dark:bg-red-950/70 dark:text-red-100",
    dot: "bg-red-500 dark:bg-red-400",
  },
};

function SingleToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const tone = TONE_STYLES[toast.tone];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <li
      className={cn(
        "pointer-events-auto rounded-lg border shadow-lg backdrop-blur-xl transition-all duration-200 ease-out",
        mounted ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
        tone.container,
      )}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone.dot)} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-semibold leading-5">{toast.title}</p>
          {toast.body && (
            <p className="text-xs leading-4 opacity-65">{toast.body}</p>
          )}
          {toast.action && (
            <Link
              to={toast.action.href}
              onClick={() => onDismiss(toast.id)}
              className="mt-1.5 inline-flex text-xs font-medium underline underline-offset-4 hover:opacity-90"
            >
              {toast.action.label}
            </Link>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
          className="mt-0.5 shrink-0 rounded-md p-1 opacity-40 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

/**
 * Fixed-position toast notification viewport.
 * Renders toasts from bottom-left with slide-in animations.
 */
export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 left-4 z-[120] w-full max-w-sm"
    >
      <ol className="flex w-full flex-col-reverse gap-2.5">
        {toasts.map((t) => (
          <SingleToast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </ol>
    </aside>
  );
}
