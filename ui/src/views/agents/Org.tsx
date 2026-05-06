/**
 * Org chart: status colors from `getStatusTokens`; recursive tree nodes
 * live in a subcomponent that receives a tokens helper.
 */

import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../../api/agents";
import { useProject } from "../../context/ProjectContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { queryKeys } from "../../lib/queryKeys";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { ChevronRight, GitBranch } from "lucide-react";
import { cn } from "../../lib/utils";
import { getStatusTokens } from "../../lib/status-colors";

const ROW_INDENT_PX = 16;
const ROW_BASE_PX = 12;

interface OrgTreeProps {
  nodes: OrgNode[];
  depth?: number;
  hrefFn: (id: string) => string;
}

function OrgTreeLevel({ nodes, depth = 0, hrefFn }: OrgTreeProps) {
  return (
    <div>
      {nodes.map((node) => (
        <OrgTreeRow key={node.id} node={node} depth={depth} hrefFn={hrefFn} />
      ))}
    </div>
  );
}

function OrgTreeRow({
  node,
  depth,
  hrefFn,
}: {
  node: OrgNode;
  depth: number;
  hrefFn: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.reports.length > 0;
  const tokens = getStatusTokens(node.status);

  return (
    <div>
      <Link
        to={hrefFn(node.id)}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer hover:bg-accent/50 no-underline text-inherit"
        style={{ paddingLeft: `${depth * ROW_INDENT_PX + ROW_BASE_PX}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className={cn("h-2 w-2 rounded-full shrink-0", tokens.dot)} />
        <span className="font-medium flex-1">{node.name}</span>
        <span className="text-xs text-muted-foreground">{node.role}</span>
        <StatusBadge status={node.status} />
      </Link>
      {hasChildren && expanded && (
        <OrgTreeLevel nodes={node.reports} depth={depth + 1} hrefFn={hrefFn} />
      )}
    </div>
  );
}

export function Org() {
  const { selectedProjectId } = useProject();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Org Chart" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.org(selectedProjectId!),
    queryFn: () => agentsApi.org(selectedProjectId!),
    enabled: !!selectedProjectId,
  });

  if (!selectedProjectId) {
    return <EmptyState icon={GitBranch} message="Select a project to view org chart." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && data.length === 0 && (
        <EmptyState
          icon={GitBranch}
          message="No agents in the organization. Create agents to build your org chart."
        />
      )}

      {data && data.length > 0 && (
        <div className="border border-border py-1">
          <OrgTreeLevel nodes={data} hrefFn={(id) => `/agents/${id}`} />
        </div>
      )}
    </div>
  );
}
