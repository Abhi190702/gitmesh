/**
 * Backward-compatibility shim.
 *
 * Theme state has moved into the unified `UIContext`. This file re-exports
 * the public surface (`useTheme`, `ThemeProvider`) so existing call-sites
 * keep working.
 */

import { useUI, type Theme } from "./UIContext";

export type { Theme };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/** Drop-in replacement for the legacy `useTheme()` hook. */
export function useTheme(): ThemeContextValue {
  const { theme, setTheme, toggleTheme } = useUI();
  return { theme, setTheme, toggleTheme };
}

/**
 * Legacy provider name. State now lives in `<UIProvider>`; rendered as a
 * no-op pass-through for any code still nesting `<ThemeProvider>`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
