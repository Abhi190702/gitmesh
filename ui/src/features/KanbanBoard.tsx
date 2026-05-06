import { useMemo, useState, useCallback } from "react";
import { Link } from "@/lib/router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { Identity } from "../components/Identity";
import type { Issue } from "@gitmesh/core";

// ── Constants ──────────────────────────────────────────────────────────────

const BOARD_COLUMNS = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;

type BoardStatus = typeof BOARD_COLUMNS[number];

function statusToLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ─────────────────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
}

// ── Droppable column ──────────────────────────────────────────────────────

function ColumnDropZone({
  status,
  issues,
  children,
}: {
  status: BoardStatus;
  issues: Issue[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <ColumnHeader status={status} count={issues.length} />
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-md p-1 space-y-1 transition-colors ${
          isOver ? "bg-accent/40" : "bg-muted/20"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </div>
    </div>
  );
}

function ColumnHeader({ status, count }: { status: BoardStatus; count: number }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 mb-1">
      <StatusIcon status={status} />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {statusToLabel(status)}
      </span>
      <span className="text-xs text-muted-foreground/60 ml-auto tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ── Draggable card ─────────────────────────────────────────────────────────

function DraggableCard({
  issue,
  agents,
  isLive,
  isOverlay,
}: {
  issue: Issue;
  agents?: Agent[];
  isLive?: boolean;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assigneeName = agents?.find((a) => a.id === issue.assigneeAgentId)?.name;

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) e.preventDefault();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={buildCardClassName(isDragging, isOverlay)}
    >
      <Link
        to={`/issues/${issue.identifier ?? issue.id}`}
        className="block no-underline text-inherit"
        onClick={handleClick}
      >
        <CardHeader issue={issue} isLive={isLive} />
        <CardBody issue={issue} />
        <CardFooter issue={issue} assigneeName={assigneeName} />
      </Link>
    </div>
  );
}

function buildCardClassName(isDragging: boolean, isOverlay?: boolean): string {
  const base = "rounded-md border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-shadow";
  const dragging = isDragging && !isOverlay ? "opacity-30" : "";
  const overlay = isOverlay ? "shadow-lg ring-1 ring-primary/20" : "hover:shadow-sm";
  return [base, dragging, overlay].filter(Boolean).join(" ");
}

function CardHeader({ issue, isLive }: { issue: Issue; isLive?: boolean }) {
  return (
    <div className="flex items-start gap-1.5 mb-1.5">
      <span className="text-xs text-muted-foreground font-mono shrink-0">
        {issue.identifier ?? issue.id.slice(0, 8)}
      </span>
      {isLive && <LiveIndicator />}
    </div>
  );
}

function LiveIndicator() {
  return (
    <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
    </span>
  );
}

function CardBody({ issue }: { issue: Issue }) {
  return <p className="text-sm leading-snug line-clamp-2 mb-2">{issue.title}</p>;
}

function CardFooter({ issue, assigneeName }: { issue: Issue; assigneeName?: string }) {
  return (
    <div className="flex items-center gap-2">
      <PriorityIcon priority={issue.priority} />
      {issue.assigneeAgentId && (
        assigneeName ? (
          <Identity name={assigneeName} size="xs" />
        ) : (
          <span className="text-xs text-muted-foreground font-mono">
            {issue.assigneeAgentId.slice(0, 8)}
          </span>
        )
      )}
    </div>
  );
}

// ── Drag handlers ─────────────────────────────────────────────────────────

function buildColumnMap(issues: Issue[]): Record<BoardStatus, Issue[]> {
  const map: Record<BoardStatus, Issue[]> = {} as Record<BoardStatus, Issue[]>;
  for (const col of BOARD_COLUMNS) {
    map[col] = [];
  }
  for (const issue of issues) {
    if (map[issue.status as BoardStatus]) {
      map[issue.status as BoardStatus].push(issue);
    }
  }
  return map;
}

function findTargetStatus(overId: string, issues: Issue[]): BoardStatus | null {
  if (BOARD_COLUMNS.includes(overId as BoardStatus)) {
    return overId as BoardStatus;
  }
  const targetIssue = issues.find((i) => i.id === overId);
  return targetIssue ? (targetIssue.status as BoardStatus) : null;
}

// ── Main board ────────────────────────────────────────────────────────────

export function KanbanBoard({
  issues,
  agents,
  liveIssueIds,
  onUpdateIssue,
}: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnMap = useMemo(() => buildColumnMap(issues), [issues]);

  const activeIssue = useMemo(
    () => (draggingId ? issues.find((i) => i.id === draggingId) : null),
    [draggingId, issues]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    const targetStatus = findTargetStatus(over.id as string, issues);
    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue(issueId, { status: targetStatus });
    }
  }, [issues, onUpdateIssue]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
        {BOARD_COLUMNS.map((status) => (
          <ColumnDropZone
            key={status}
            status={status}
            issues={columnMap[status]}
          >
            {columnMap[status].map((issue) => (
              <DraggableCard
                key={issue.id}
                issue={issue}
                agents={agents}
                isLive={liveIssueIds?.has(issue.id)}
              />
            ))}
          </ColumnDropZone>
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <DraggableCard issue={activeIssue} agents={agents} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
