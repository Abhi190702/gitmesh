import type { HeartbeatRun } from "@gitmesh/core";

// ── Date utilities ─────────────────────────────────────────────────────────

export function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
}

function toDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Chart primitives ──────────────────────────────────────────────────────

function DayLabels({ days }: { days: string[] }) {
  return (
    <div className="flex gap-[3px] mt-1.5">
      {days.map((day, i) => (
        <div key={day} className="flex-1 text-center">
          {i === 0 || i === 6 || i === 13 ? (
            <span className="text-[9px] text-muted-foreground tabular-nums">{toDayLabel(day)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div>
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">{title}</h3>
        {subtitle && <span className="font-mono text-[10px] tracking-wide text-text-tertiary">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Stacked bar chart ─────────────────────────────────────────────────────

function StackedBar({
  segments,
  maxValue,
}: {
  segments: { value: number; color: string }[];
  maxValue: number;
}) {
  const heightPct = maxValue > 0 ? (segments.reduce((s, seg) => s + seg.value, 0) / maxValue) * 100 : 0;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) {
    return <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />;
  }

  return (
    <div
      className="flex flex-col-reverse gap-px overflow-hidden"
      style={{ height: `${heightPct}%`, minHeight: 2 }}
    >
      {segments.map((seg, i) =>
        seg.value > 0 ? (
          <div key={i} style={{ flex: seg.value, backgroundColor: seg.color }} />
        ) : null
      )}
    </div>
  );
}

function BarChart({
  days,
  buildSegments,
}: {
  days: string[];
  buildSegments: (day: string) => { value: number; color: string }[];
}) {
  const maxValue = Math.max(
    ...days.map((day) => buildSegments(day).reduce((s, seg) => s + seg.value, 0)),
    1,
  );
  const hasData = days.some((day) => buildSegments(day).some((seg) => seg.value > 0));

  if (!hasData) return <p className="text-xs text-muted-foreground">No data</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map((day) => {
          const segments = buildSegments(day);
          return (
            <div
              key={day}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${day}: ${segments.reduce((s, seg) => s + seg.value, 0)} items`}
            >
              <StackedBar segments={segments} maxValue={maxValue} />
            </div>
          );
        })}
      </div>
      <DayLabels days={days} />
    </div>
  );
}

// ── Run activity chart ────────────────────────────────────────────────────

const RUN_COLORS = {
  succeeded: "#10b981",
  failed: "#ef4444",
  other: "#6b7280",
} as const;

export function RunActivityChart({ runs }: { runs: HeartbeatRun[] }) {
  const days = getLast14Days();

  const dailyData = new Map<string, { succeeded: number; failed: number; other: number }>();
  for (const day of days) dailyData.set(day, { succeeded: 0, failed: 0, other: 0 });

  for (const run of runs) {
    const day = new Date(run.createdAt).toISOString().slice(0, 10);
    const entry = dailyData.get(day);
    if (!entry) continue;
    if (run.status === "succeeded") entry.succeeded++;
    else if (run.status === "failed" || run.status === "timed_out") entry.failed++;
    else entry.other++;
  }

  return (
    <BarChart
      days={days}
      buildSegments={(day) => {
        const entry = dailyData.get(day)!;
        const { succeeded, failed, other } = entry;
        return [
          { value: succeeded, color: RUN_COLORS.succeeded },
          { value: failed, color: RUN_COLORS.failed },
          { value: other, color: RUN_COLORS.other },
        ];
      }}
    />
  );
}

// ── Priority chart ────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

export function PriorityChart({ issues }: { issues: { priority: string; createdAt: Date }[] }) {
  const days = getLast14Days();

  const dailyData = new Map<string, Record<string, number>>();
  for (const day of days) {
    dailyData.set(day, { critical: 0, high: 0, medium: 0, low: 0 });
  }

  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = dailyData.get(day);
    if (!entry) continue;
    if (issue.priority in entry) entry[issue.priority]++;
  }

  return (
    <BarChart
      days={days}
      buildSegments={(day) => {
        const entry = dailyData.get(day)!;
        return PRIORITY_ORDER.map((p) => ({
          value: entry[p],
          color: PRIORITY_COLORS[p],
        }));
      }}
    />
  );
}

// ── Issue status chart ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: "#3b82f6",
  in_progress: "#8b5cf6",
  in_review: "#a855f7",
  done: "#10b981",
  blocked: "#ef4444",
  cancelled: "#6b7280",
  backlog: "#64748b",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
  backlog: "Backlog",
};

const STATUS_ORDER = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled", "backlog"] as const;

export function IssueStatusChart({ issues }: { issues: { status: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const allStatuses = new Set<string>();

  const dailyData = new Map<string, Record<string, number>>();
  for (const day of days) dailyData.set(day, {});

  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = dailyData.get(day);
    if (!entry) continue;
    entry[issue.status] = (entry[issue.status] ?? 0) + 1;
    allStatuses.add(issue.status);
  }

  const activeStatuses = STATUS_ORDER.filter((s) => allStatuses.has(s));

  return (
    <BarChart
      days={days}
      buildSegments={(day) => {
        const entry = dailyData.get(day)!;
        return activeStatuses.map((s) => ({
          value: entry[s] ?? 0,
          color: STATUS_COLORS[s] ?? "#6b7280",
        }));
      }}
    />
  );
}

// ── Success rate chart ─────────────────────────────────────────────────────

export function SuccessRateChart({ runs }: { runs: HeartbeatRun[] }) {
  const days = getLast14Days();

  const dailyData = new Map<string, { succeeded: number; total: number }>();
  for (const day of days) dailyData.set(day, { succeeded: 0, total: 0 });

  for (const run of runs) {
    const day = new Date(run.createdAt).toISOString().slice(0, 10);
    const entry = dailyData.get(day);
    if (!entry) continue;
    entry.total++;
    if (run.status === "succeeded") entry.succeeded++;
  }

  const hasData = days.some((day) => dailyData.get(day)!.total > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  const getBarColor = (succeeded: number, total: number) => {
    if (total === 0) return undefined;
    const rate = succeeded / total;
    return rate >= 0.8 ? "#10b981" : rate >= 0.5 ? "#eab308" : "#ef4444";
  };

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map((day) => {
          const { succeeded, total } = dailyData.get(day)!;
          const rate = total > 0 ? succeeded / total : 0;
          const color = getBarColor(succeeded, total);

          return (
            <div
              key={day}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${day}: ${total > 0 ? Math.round(rate * 100) : 0}% (${succeeded}/${total})`}
            >
              {total > 0 ? (
                <div style={{ height: `${rate * 100}%`, minHeight: 2, backgroundColor: color }} />
              ) : (
                <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>
      <DayLabels days={days} />
    </div>
  );
}
