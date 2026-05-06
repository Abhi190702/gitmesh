import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import type { IssueComment, Agent } from "@gitmesh/core";
import { Button } from "@/components/ui/button";
import { Check, Copy, ImagePlus } from "lucide-react";
import { Identity } from "../components/Identity";
import { InlineEntitySelector, type InlineEntityOption } from "../components/InlineEntitySelector";
import { MarkdownBody } from "../components/MarkdownBody";
import { MarkdownEditor, type MarkdownEditorRef, type MentionOption } from "../components/MarkdownEditor";
import { StatusBadge } from "../components/StatusBadge";
import { AgentIcon } from "./AgentIconPicker";
import { formatDateTime } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface CommentWithRunMeta extends IssueComment {
  runId?: string | null;
  runAgentId?: string | null;
}

interface LinkedRunItem {
  runId: string;
  status: string;
  agentId: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
}

interface CommentReassignment {
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
}

interface CommentThreadProps {
  comments: CommentWithRunMeta[];
  linkedRuns?: LinkedRunItem[];
  onAdd: (body: string, reopen?: boolean, reassignment?: CommentReassignment) => Promise<void>;
  issueStatus?: string;
  agentMap?: Map<string, Agent>;
  imageUploadHandler?: (file: File) => Promise<string>;
  onAttachImage?: (file: File) => Promise<void>;
  draftKey?: string;
  liveRunSlot?: React.ReactNode;
  enableReassign?: boolean;
  reassignOptions?: InlineEntityOption[];
  currentAssigneeValue?: string;
  mentions?: MentionOption[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const CLOSED_STATUSES = new Set(["done", "cancelled"]);
const DRAFT_DEBOUNCE_MS = 800;

// ── Draft persistence ─────────────────────────────────────────────────────

function loadDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function persistDraft(key: string, value: string) {
  try {
    if (value.trim()) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

function eraseDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ── Reassignment parsing ───────────────────────────────────────────────────

function parseReassignmentTarget(target: string): CommentReassignment | null {
  if (!target || target === "__none__") {
    return { assigneeAgentId: null, assigneeUserId: null };
  }
  if (target.startsWith("agent:")) {
    const id = target.slice("agent:".length);
    return id ? { assigneeAgentId: id, assigneeUserId: null } : null;
  }
  if (target.startsWith("user:")) {
    const id = target.slice("user:".length);
    return id ? { assigneeAgentId: null, assigneeUserId: id } : null;
  }
  return null;
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Copy as markdown"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Timeline item types ───────────────────────────────────────────────────

type TimelineEntry =
  | { kind: "comment"; id: string; createdAtMs: number; comment: CommentWithRunMeta }
  | { kind: "run"; id: string; createdAtMs: number; run: LinkedRunItem };

// ── Run entry component ──────────────────────────────────────────────────

function RunEntry({
  run,
  agentMap,
}: {
  run: LinkedRunItem;
  agentMap?: Map<string, Agent>;
}) {
  const agentName = agentMap?.get(run.agentId)?.name ?? run.agentId.slice(0, 8);

  return (
    <div className="border border-border bg-accent/20 p-3 overflow-hidden min-w-0 rounded-sm">
      <div className="flex items-center justify-between mb-2">
        <Link to={`/agents/${run.agentId}`} className="hover:underline">
          <Identity name={agentName} size="sm" />
        </Link>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(run.startedAt ?? run.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Run</span>
        <Link
          to={`/agents/${run.agentId}/runs/${run.runId}`}
          className="inline-flex items-center rounded-md border border-border bg-accent/40 px-2 py-1 font-mono text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          {run.runId.slice(0, 8)}
        </Link>
        <StatusBadge status={run.status} />
      </div>
    </div>
  );
}

// ── Comment entry component ───────────────────────────────────────────────

function CommentEntry({
  comment,
  agentMap,
  isHighlighted,
}: {
  comment: CommentWithRunMeta;
  agentMap?: Map<string, Agent>;
  isHighlighted: boolean;
}) {
  const authorName = comment.authorAgentId
    ? agentMap?.get(comment.authorAgentId)?.name ?? comment.authorAgentId.slice(0, 8)
    : "You";

  return (
    <div
      id={`comment-${comment.id}`}
      className={`border p-3 overflow-hidden min-w-0 rounded-sm transition-colors duration-1000 ${
        isHighlighted ? "border-primary/50 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        {comment.authorAgentId ? (
          <Link to={`/agents/${comment.authorAgentId}`} className="hover:underline">
            <Identity name={authorName} size="sm" />
          </Link>
        ) : (
          <Identity name="You" size="sm" />
        )}
        <span className="flex items-center gap-1.5">
          <a
            href={`#comment-${comment.id}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            {formatDateTime(comment.createdAt)}
          </a>
          <CopyButton text={comment.body} />
        </span>
      </div>
      <MarkdownBody className="text-sm">{comment.body}</MarkdownBody>
      {comment.runId && <RunLinkBadge comment={comment} />}
    </div>
  );
}

function RunLinkBadge({ comment }: { comment: CommentWithRunMeta }) {
  return (
    <div className="mt-2 pt-2 border-t border-border/60">
      {comment.runAgentId ? (
        <Link
          to={`/agents/${comment.runAgentId}/runs/${comment.runId}`}
          className="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          run {(comment.runId ?? "").slice(0, 8)}
        </Link>
      ) : (
        <span className="inline-flex items-center rounded-md border border-border bg-accent/30 px-2 py-1 text-[10px] font-mono text-muted-foreground">
          run {(comment.runId ?? "").slice(0, 8)}
        </span>
      )}
    </div>
  );
}

// ── Timeline list ─────────────────────────────────────────────────────────

const TimelineList = memo(function TimelineList({
  entries,
  agentMap,
  highlightedId,
}: {
  entries: TimelineEntry[];
  agentMap?: Map<string, Agent>;
  highlightedId?: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments or runs yet.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        if (entry.kind === "run") {
          return (
            <div key={`run:${entry.run.runId}`}>
              <RunEntry run={entry.run} agentMap={agentMap} />
            </div>
          );
        }
        return (
          <div key={entry.comment.id}>
            <CommentEntry
              comment={entry.comment}
              agentMap={agentMap}
              isHighlighted={highlightedId === entry.comment.id}
            />
          </div>
        );
      })}
    </div>
  );
});

// ── Assignee selector renderer ─────────────────────────────────────────────

function AssigneeTrigger({
  option,
  agentMap,
}: {
  option: InlineEntityOption | null;
  agentMap?: Map<string, Agent>;
}) {
  if (!option) return <span className="text-muted-foreground">Assignee</span>;
  const agentId = option.id.startsWith("agent:") ? option.id.slice("agent:".length) : null;
  const agent = agentId ? agentMap?.get(agentId) : null;
  return (
    <>
      {agent ? (
        <AgentIcon icon={agent.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="truncate">{option.label}</span>
    </>
  );
}

function AssigneeOption({
  option,
  agentMap,
}: {
  option: InlineEntityOption;
  agentMap?: Map<string, Agent>;
}) {
  if (!option.id) return <span className="truncate">{option.label}</span>;
  const agentId = option.id.startsWith("agent:") ? option.id.slice("agent:".length) : null;
  const agent = agentId ? agentMap?.get(agentId) : null;
  return (
    <>
      {agent ? (
        <AgentIcon icon={agent.icon} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      <span className="truncate">{option.label}</span>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function CommentThread({
  comments,
  linkedRuns = [],
  onAdd,
  issueStatus,
  agentMap,
  imageUploadHandler,
  onAttachImage,
  draftKey,
  liveRunSlot,
  enableReassign = false,
  reassignOptions = [],
  currentAssigneeValue = "",
  mentions: providedMentions,
}: CommentThreadProps) {
  const [body, setBody] = useState("");
  const [reopenIssue, setReopenIssue] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(currentAssigneeValue);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const hasScrolledRef = useRef(false);

  const isClosed = issueStatus ? CLOSED_STATUSES.has(issueStatus) : false;

  // Build timeline from comments and runs
  const timeline = useMemo<TimelineEntry[]>(() => {
    const commentEntries: TimelineEntry[] = comments.map((c) => ({
      kind: "comment",
      id: c.id,
      createdAtMs: new Date(c.createdAt).getTime(),
      comment: c,
    }));
    const runEntries: TimelineEntry[] = linkedRuns.map((r) => ({
      kind: "run",
      id: r.runId,
      createdAtMs: new Date(r.startedAt ?? r.createdAt).getTime(),
      run: r,
    }));
    return [...commentEntries, ...runEntries].sort((a, b) => {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
      if (a.kind === b.kind) return a.id.localeCompare(b.id);
      return a.kind === "comment" ? -1 : 1;
    });
  }, [comments, linkedRuns]);

  // Build mention options
  const mentions = useMemo<MentionOption[]>(() => {
    if (providedMentions) return providedMentions;
    if (!agentMap) return [];
    return Array.from(agentMap.values())
      .filter((a) => a.status !== "terminated")
      .map((a) => ({ id: a.id, name: a.name }));
  }, [agentMap, providedMentions]);

  // Load draft on mount
  useEffect(() => {
    if (!draftKey) return;
    setBody(loadDraft(draftKey));
  }, [draftKey]);

  // Save draft on change (debounced)
  useEffect(() => {
    if (!draftKey) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      persistDraft(draftKey, body);
    }, DRAFT_DEBOUNCE_MS);
  }, [body, draftKey]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, []);

  // Sync reassign target
  useEffect(() => {
    setReassignTarget(currentAssigneeValue);
  }, [currentAssigneeValue]);

  // Scroll to highlighted comment from URL hash
  useEffect(() => {
    const hash = location.hash;
    if (!hash.startsWith("#comment-") || comments.length === 0) return;
    const commentId = hash.slice("#comment-".length);
    if (hasScrolledRef.current) return;
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      hasScrolledRef.current = true;
      setHighlightedId(commentId);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [location.hash, comments]);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const hasReassignment = enableReassign && reassignTarget !== currentAssigneeValue;
    const reassignment = hasReassignment ? parseReassignmentTarget(reassignTarget) : null;

    setSubmitting(true);
    try {
      await onAdd(trimmed, isClosed && reopenIssue ? true : undefined, reassignment ?? undefined);
      setBody("");
      if (draftKey) eraseDraft(draftKey);
      setReopenIssue(false);
      setReassignTarget(currentAssigneeValue);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachFile = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file || !onAttachImage) return;
    setAttaching(true);
    try {
      await onAttachImage(file);
    } finally {
      setAttaching(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  };

  const canSubmit = !submitting && !!body.trim();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Comments &amp; Runs ({timeline.length})</h3>

      <TimelineList entries={timeline} agentMap={agentMap} highlightedId={highlightedId} />

      {liveRunSlot}

      <div className="space-y-2">
        <MarkdownEditor
          ref={editorRef}
          value={body}
          onChange={setBody}
          placeholder="Leave a comment..."
          mentions={mentions}
          onSubmit={handleSubmit}
          imageUploadHandler={imageUploadHandler}
          contentClassName="min-h-[60px] text-sm"
        />
        <div className="flex items-center justify-end gap-3">
          {onAttachImage && (
            <div className="mr-auto flex items-center gap-3">
              <input
                ref={attachInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAttachFile}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => attachInputRef.current?.click()}
                disabled={attaching}
                title="Attach image"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
          )}
          {isClosed && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reopenIssue}
                onChange={(e) => setReopenIssue(e.target.checked)}
                className="rounded border-border"
              />
              Re-open
            </label>
          )}
          {enableReassign && reassignOptions.length > 0 && (
            <InlineEntitySelector
              value={reassignTarget}
              options={reassignOptions}
              placeholder="Assignee"
              noneLabel="No assignee"
              searchPlaceholder="Search assignees..."
              emptyMessage="No assignees found."
              onChange={setReassignTarget}
              className="text-xs h-8"
              renderTriggerValue={(opt) => <AssigneeTrigger option={opt} agentMap={agentMap} />}
              renderOption={(opt) => <AssigneeOption option={opt} agentMap={agentMap} />}
            />
          )}
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Posting..." : "Comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
