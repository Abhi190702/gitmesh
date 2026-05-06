import type { Goal } from "@gitmesh/core";
import { Link } from "@/lib/router";
import { StatusBadge } from "../components/StatusBadge";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

interface MilestoneTreeProps {
  goals: Goal[];
  milestoneLink?: (milestone: Goal) => string;
  onSelect?: (milestone: Goal) => void;
}

interface GoalNodeProps {
  milestone: Goal;
  children: Goal[];
  allGoals: Goal[];
  depth: number;
  milestoneLink?: (milestone: Goal) => string;
  onSelect?: (milestone: Goal) => void;
}

function GoalNode({ milestone, children, allGoals, depth, milestoneLink, onSelect }: GoalNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const link = milestoneLink?.(milestone);

  const inner = (
    <>
      {hasChildren ? (
        <button
          className="p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="w-4" />
      )}
      <span className="text-xs text-muted-foreground capitalize">{milestone.level}</span>
      <span className="flex-1 truncate">{milestone.title}</span>
      <StatusBadge status={milestone.status} />
    </>
  );

  const classes = cn(
    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer hover:bg-accent/50",
  );

  return (
    <div>
      {link ? (
        <Link
          to={link}
          className={cn(classes, "no-underline text-inherit")}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {inner}
        </Link>
      ) : (
        <div
          className={classes}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => onSelect?.(milestone)}
        >
          {inner}
        </div>
      )}
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <GoalNode
              key={child.id}
              milestone={child}
              children={allGoals.filter((g) => g.parentId === child.id)}
              allGoals={allGoals}
              depth={depth + 1}
              milestoneLink={milestoneLink}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MilestoneTree({ goals, milestoneLink, onSelect }: MilestoneTreeProps) {
  const milestoneIds = new Set(goals.map((g) => g.id));
  const roots = goals.filter((g) => !g.parentId || !milestoneIds.has(g.parentId));

  if (goals.length === 0) {
    return <p className="text-sm text-muted-foreground">No goals.</p>;
  }

  return (
    <div className="border border-border py-1">
      {roots.map((milestone) => (
        <GoalNode
          key={milestone.id}
          milestone={milestone}
          children={goals.filter((g) => g.parentId === milestone.id)}
          allGoals={goals}
          depth={0}
          milestoneLink={milestoneLink}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
