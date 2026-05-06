/**
 * Backward-compatibility shim.
 *
 * Toast state has moved into the unified `UIContext`. This file re-exports
 * the public surface so existing `useToast()` / `import { ToastInput }`
 * call-sites keep working without churn.
 */

import { useUI, type ToastItem, type ToastInput, type ToastTone, type ToastAction } from "./UIContext";

export type { ToastItem, ToastInput, ToastTone, ToastAction };

export interface ToastContextValue {
  toasts: ToastItem[];
  pushToast: (input: ToastInput) => string | null;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

/** Drop-in replacement for the legacy `useToast()` hook. */
export function useToast(): ToastContextValue {
  const { toasts, pushToast, dismissToast, clearToasts } = useUI();
  return { toasts, pushToast, dismissToast, clearToasts };
}

/**
 * Legacy provider name. The actual state lives in `<UIProvider>` mounted at
 * the app root; this is a no-op pass-through for any code that still nests
 * `<ToastProvider>`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
