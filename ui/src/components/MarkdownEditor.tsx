import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  CodeMirrorEditor,
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  type CodeBlockEditorDescriptor,
  type MDXEditorMethods,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type RealmPlugin,
} from "@mdxeditor/editor";
import { buildProjectMentionHref, parseProjectMentionHref } from "@gitmesh/core";
import { cn } from "../lib/utils";

// ── Mention types ─────────────────────────────────────────────────────────

export interface MentionOption {
  id: string;
  name: string;
  kind?: "agent" | "project";
  projectId?: string;
  projectColor?: string | null;
}

// ── Editor props ──────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  onBlur?: () => void;
  imageUploadHandler?: (file: File) => Promise<string>;
  bordered?: boolean;
  mentions?: MentionOption[];
  onSubmit?: () => void;
}

export interface MarkdownEditorRef {
  focus: () => void;
}

// ── Mention detection ───────────────────────────────────────────────────

interface MentionState {
  query: string;
  top: number;
  left: number;
  textNode: Text;
  atPos: number;
  endPos: number;
}

const LANG_MAP: Record<string, string> = {
  txt: "Text", md: "Markdown", js: "JavaScript", jsx: "JavaScript (JSX)",
  ts: "TypeScript", tsx: "TypeScript (TSX)", json: "JSON", bash: "Bash",
  sh: "Shell", python: "Python", go: "Go", rust: "Rust", sql: "SQL",
  html: "HTML", css: "CSS", yaml: "YAML", yml: "YAML",
};

const FALLBACK_BLOCK: CodeBlockEditorDescriptor = {
  priority: 0,
  match: () => true,
  Editor: CodeMirrorEditor,
};

// ── Mention DOM helpers ───────────────────────────────────────────────────

function findMentionTrigger(container: HTMLElement): MentionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if (!container.contains(node)) return null;

  const text = node.textContent ?? "";
  const offset = range.startOffset;

  let atPos = -1;
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      if (i === 0 || /\s/.test(text[i - 1])) atPos = i;
      break;
    }
    if (/\s/.test(ch)) break;
  }
  if (atPos === -1) return null;

  const query = text.slice(atPos + 1, offset);
  const tmp = document.createRange();
  tmp.setStart(node, atPos);
  tmp.setEnd(node, atPos + 1);
  const rect = tmp.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return {
    query,
    top: rect.bottom - containerRect.top,
    left: rect.left - containerRect.left,
    textNode: node as Text,
    atPos,
    endPos: offset,
  };
}

function buildMentionToken(opt: MentionOption): string {
  if (opt.kind === "project" && opt.projectId) {
    return `[@${opt.name}](${buildProjectMentionHref(opt.projectId, opt.projectColor ?? null)}) `;
  }
  return `@${opt.name} `;
}

function applyMentionToMarkdown(markdown: string, query: string, opt: MentionOption): string {
  const search = `@${query}`;
  const replacement = buildMentionToken(opt);
  const idx = markdown.lastIndexOf(search);
  if (idx === -1) return markdown;
  return markdown.slice(0, idx) + replacement + markdown.slice(idx + search.length);
}

// ── Styling helpers ─────────────────────────────────────────────────────

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function chipStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  const rgb = parseHexColor(color);
  if (!rgb) return undefined;
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return {
    borderColor: color,
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: lum > 0.55 ? "#111827" : "#f8fafc",
  };
}

// ── Project mention decoration ────────────────────────────────────────────

function decorateMentions(container: HTMLElement, colorMap: Map<string, string | null>) {
  const editable = container.querySelector('[contenteditable="true"]');
  if (!editable) return;
  const links = editable.querySelectorAll("a");
  for (const node of links) {
    const a = node as HTMLAnchorElement;
    const parsed = parseProjectMentionHref(a.getAttribute("href") ?? "");
    if (!parsed) {
      if (a.dataset.projectMention === "true") {
        a.dataset.projectMention = "false";
        a.classList.remove("gitmesh-agents-project-mention-chip");
        a.removeAttribute("contenteditable");
        a.style.removeProperty("border-color");
        a.style.removeProperty("background-color");
        a.style.removeProperty("color");
      }
      continue;
    }
    const color = parsed.color ?? colorMap.get(parsed.projectId) ?? null;
    a.dataset.projectMention = "true";
    a.classList.add("gitmesh-agents-project-mention-chip");
    a.setAttribute("contenteditable", "false");
    const s = chipStyle(color);
    if (s) {
      a.style.borderColor = s.borderColor ?? "";
      a.style.backgroundColor = s.backgroundColor ?? "";
      a.style.color = s.color ?? "";
    }
  }
}

// ── Main component ────────────────────────────────────────────────────────

export const MarkdownEditor = forwardRef<MarkdownEditorRef, Props>(function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  contentClassName,
  onBlur,
  imageUploadHandler,
  bordered = true,
  mentions,
  onSubmit,
}: Props, fwdRef) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MDXEditorMethods>(null);
  const latestValue = useRef(value);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);

  // Stable image handler ref for plugins
  const imageHandlerRef = useRef(imageUploadHandler);
  imageHandlerRef.current = imageUploadHandler;

  // Mention state
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const mentionStateRef = useRef<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionActive = mentionState !== null && mentions && mentions.length > 0;

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of mentions ?? []) {
      if (m.kind === "project" && m.projectId) map.set(m.projectId, m.projectColor ?? null);
    }
    return map;
  }, [mentions]);

  const filteredMentions = useMemo(() => {
    if (!mentionState || !mentions) return [];
    const q = mentionState.query.toLowerCase();
    return mentions.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionState?.query, mentions]);

  useImperativeHandle(fwdRef, () => ({
    focus: () => editorRef.current?.focus(undefined, { defaultSelection: "rootEnd" }),
  }), []);

  const hasImageUpload = Boolean(imageUploadHandler);

  const plugins = useMemo<RealmPlugin[]>(() => {
    const imgHandler = hasImageUpload
      ? async (file: File) => {
          const h = imageHandlerRef.current;
          if (!h) throw new Error("No image upload handler");
          try {
            const src = await h(file);
            setUploadError(null);
            return src;
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : "Image upload failed");
            throw err;
          }
        }
      : undefined;

    const all: RealmPlugin[] = [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      thematicBreakPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "txt", codeBlockEditorDescriptors: [FALLBACK_BLOCK] }),
      codeMirrorPlugin({ codeBlockLanguages: LANG_MAP }),
      markdownShortcutPlugin(),
    ];
    if (imgHandler) all.push(imagePlugin({ imageUploadHandler: imgHandler }));
    return all;
  }, [hasImageUpload]);

  useEffect(() => {
    if (value !== latestValue.current) {
      editorRef.current?.setMarkdown(value);
      latestValue.current = value;
    }
  }, [value]);

  const checkMention = useCallback(() => {
    if (!mentions || mentions.length === 0 || !containerRef.current) {
      mentionStateRef.current = null;
      setMentionState(null);
      return;
    }
    const result = findMentionTrigger(containerRef.current);
    mentionStateRef.current = result;
    if (result) {
      setMentionState(result);
      setMentionIndex(0);
    } else {
      setMentionState(null);
    }
  }, [mentions]);

  useEffect(() => {
    if (!mentions || mentions.length === 0) return;
    const el = containerRef.current;
    const onInput = () => requestAnimationFrame(checkMention);
    document.addEventListener("selectionchange", checkMention);
    el?.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("selectionchange", checkMention);
      el?.removeEventListener("input", onInput, true);
    };
  }, [checkMention, mentions]);

  useEffect(() => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (!editable) return;
    decorateMentions(containerRef.current!, projectColorMap);
    const observer = new MutationObserver(() => decorateMentions(containerRef.current!, projectColorMap));
    observer.observe(editable, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [projectColorMap, value]);

  const pickMention = useCallback((opt: MentionOption) => {
    const state = mentionStateRef.current;
    if (!state) return;

    const current = latestValue.current;
    if (opt.kind === "project" && opt.projectId) {
      const next = applyMentionToMarkdown(current, state.query, opt);
      if (next !== current) {
        latestValue.current = next;
        editorRef.current?.setMarkdown(next);
        onChange(next);
      }
      requestAnimationFrame(() => {
        editorRef.current?.focus(undefined, { defaultSelection: "rootEnd" });
        decorateMentions(containerRef.current!, projectColorMap);
      });
      mentionStateRef.current = null;
      setMentionState(null);
      return;
    }

    const replacement = buildMentionToken(opt);
    const sel = window.getSelection();
    if (sel && state.textNode.isConnected) {
      const range = document.createRange();
      range.setStart(state.textNode, state.atPos);
      range.setEnd(state.textNode, state.endPos);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("insertText", false, replacement);

      const targetPos = state.atPos + replacement.length;
      requestAnimationFrame(() => {
        const newSel = window.getSelection();
        if (!newSel) return;
        if (state.textNode.isConnected) {
          const len = state.textNode.textContent?.length ?? 0;
          if (targetPos <= len) {
            const r = document.createRange();
            r.setStart(state.textNode, targetPos);
            r.collapse(true);
            newSel.removeAllRanges();
            newSel.addRange(r);
            return;
          }
        }
        const editable = containerRef.current?.querySelector('[contenteditable="true"]');
        if (!editable) return;
        const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          const t = node.textContent ?? "";
          const idx = t.indexOf(replacement);
          if (idx !== -1) {
            const pos = idx + replacement.length;
            if (pos <= t.length) {
              const r = document.createRange();
              r.setStart(node, pos);
              r.collapse(true);
              newSel.removeAllRanges();
              newSel.addRange(r);
              return;
            }
          }
        }
      });
    } else {
      const next = applyMentionToMarkdown(current, state.query, opt);
      if (next !== current) {
        latestValue.current = next;
        editorRef.current?.setMarkdown(next);
        onChange(next);
      }
      requestAnimationFrame(() => editorRef.current?.focus(undefined, { defaultSelection: "rootEnd" }));
    }

    requestAnimationFrame(() => decorateMentions(containerRef.current!, projectColorMap));
    mentionStateRef.current = null;
    setMentionState(null);
  }, [projectColorMap, onChange]);

  function hasFiles(evt: DragEvent<HTMLDivElement>) {
    return Array.from(evt.dataTransfer?.types ?? []).includes("Files");
  }

  const canDropImage = Boolean(imageUploadHandler);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative gitmesh-agents-mdxeditor-scope",
        bordered ? "rounded-md border border-border bg-transparent" : "bg-transparent",
        isDragOver && "ring-1 ring-primary/60 bg-accent/20",
        className,
      )}
      onKeyDownCapture={(e) => {
        if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          onSubmit();
          return;
        }
        if (mentionActive) {
          if (e.key === " ") {
            mentionStateRef.current = null;
            setMentionState(null);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            mentionStateRef.current = null;
            setMentionState(null);
            return;
          }
          if (filteredMentions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              setMentionIndex((p) => Math.min(p + 1, filteredMentions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              setMentionIndex((p) => Math.max(p - 1, 0));
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              e.stopPropagation();
              pickMention(filteredMentions[mentionIndex]);
              return;
            }
          }
        }
      }}
      onDragEnter={(evt) => {
        if (!canDropImage || !hasFiles(evt)) return;
        dragDepth.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(evt) => {
        if (!canDropImage || !hasFiles(evt)) return;
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (!canDropImage) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragOver(false);
      }}
      onDrop={() => {
        dragDepth.current = 0;
        setIsDragOver(false);
      }}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        placeholder={placeholder}
        onChange={(next) => { latestValue.current = next; onChange(next); }}
        onBlur={() => onBlur?.()}
        className={cn("gitmesh-agents-mdxeditor", !bordered && "gitmesh-agents-mdxeditor--borderless")}
        contentEditableClassName={cn(
          "gitmesh-agents-mdxeditor-content focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:list-item",
          contentClassName,
        )}
        overlayContainer={containerRef.current}
        plugins={plugins}
      />

      {mentionActive && filteredMentions.length > 0 && (
        <div
          className="absolute z-50 min-w-[180px] max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md"
          style={{ top: mentionState.top + 4, left: mentionState.left }}
        >
          {filteredMentions.map((opt, i) => (
            <button
              key={opt.id}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent/50 transition-colors",
                i === mentionIndex && "bg-accent",
              )}
              onMouseDown={(e) => { e.preventDefault(); pickMention(opt); }}
              onMouseEnter={() => setMentionIndex(i)}
            >
              {opt.kind === "project" && opt.projectId ? (
                <span className="inline-flex h-2 w-2 rounded-full border border-border/50" style={{ backgroundColor: opt.projectColor ?? "#64748b" }} />
              ) : (
                <span className="text-muted-foreground">@</span>
              )}
              <span>{opt.name}</span>
              {opt.kind === "project" && opt.projectId && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Project</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isDragOver && canDropImage && (
        <div
          className={cn(
            "pointer-events-none absolute inset-1 z-40 flex items-center justify-center rounded-md border border-dashed border-primary/80 bg-primary/10 text-xs font-medium text-primary",
            !bordered && "inset-0 rounded-sm",
          )}
        >
          Drop image to upload
        </div>
      )}
      {uploadError && <p className="px-3 pb-2 text-xs text-destructive">{uploadError}</p>}
    </div>
  );
});
