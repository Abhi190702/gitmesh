import { useEffect, useRef } from "react";

interface ShortcutHandlers {
  onNewIssue?: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  onSwitchProject?: (index: number) => void;
  onNavigate?: (path: string) => void;
  onShowShortcuts?: () => void;
}

const CHORD_TIMEOUT = 500; // ms to wait for second key in a chord

export function useKeyboardShortcuts({
  onNewIssue,
  onToggleSidebar,
  onTogglePanel,
  onSwitchProject,
  onNavigate,
  onShowShortcuts,
}: ShortcutHandlers) {
  const pendingChord = useRef<string | null>(null);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearChord() {
      pendingChord.current = null;
      if (chordTimer.current) {
        clearTimeout(chordTimer.current);
        chordTimer.current = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Escape → cancel pending chord
      if (e.key === "Escape") {
        clearChord();
        return;
      }

      // G-chord navigation (GitHub-style: G then D/I/A/O/S)
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (pendingChord.current === "g") {
          // GG → go to dashboard
          clearChord();
          onNavigate?.("/dashboard");
          return;
        }
        pendingChord.current = "g";
        if (chordTimer.current) clearTimeout(chordTimer.current);
        chordTimer.current = setTimeout(clearChord, CHORD_TIMEOUT);
        return;
      }

      if (pendingChord.current === "g") {
        clearChord();
        switch (e.key) {
          case "d": onNavigate?.("/dashboard"); break;
          case "i": onNavigate?.("/issues"); break;
          case "a": onNavigate?.("/agents/all"); break;
          case "o": onNavigate?.("/org"); break;
          case "s": onNavigate?.("/instance-settings"); break;
        }
        return;
      }

      // Cmd+1..9 → Switch project
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        onSwitchProject?.(parseInt(e.key, 10) - 1);
        return;
      }

      // C → New Issue
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onNewIssue?.();
        return;
      }

      // [ → Toggle Sidebar (mobile)
      if (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // ] → Toggle Properties Panel
      if (e.key === "]" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onTogglePanel?.();
        return;
      }

      // ? → Show keyboard shortcuts
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, [onNewIssue, onToggleSidebar, onTogglePanel, onSwitchProject, onNavigate, onShowShortcuts]);
}
