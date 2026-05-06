import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Trash2 } from "lucide-react";
import { useProject } from "../../context/ProjectContext";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";
import { EmptyState } from "../../components/EmptyState";
import { PageSkeleton } from "../../components/PageSkeleton";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "@/components/ui/button";
import { api } from "../../api/client";
import { policyTemplatesApi, type PolicyTemplateListResponse } from "../../api/policy-templates";
import { PolicyTemplateCard, PolicyTemplateError } from "../../features/PolicyTemplateCard";

interface Policy {
  id: string;
  name: string;
  description: string | null;
  actionPattern: string;
  conditions: Record<string, unknown> | null;
  effect: "allow" | "block" | "require_approval";
  priority: number;
  version: number;
  enabled: boolean;
  createdAt: string;
}

const EFFECT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  allow: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Allow" },
  block: { bg: "bg-red-500/10", text: "text-red-400", label: "Block" },
  require_approval: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Require Approval" },
};

type Tab = "active" | "templates";

export function Policies() {
  const { selectedProjectId } = useProject();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    setBreadcrumbs([{ label: "Policies" }]);
  }, [setBreadcrumbs]);

  const { data: policies, isLoading, error } = useQuery<Policy[]>({
    queryKey: ["policies", selectedProjectId],
    queryFn: () => api.get<Policy[]>(`/projects/${selectedProjectId}/policies`),
    enabled: !!selectedProjectId,
  });

  const { data: templateData, error: templatesError } = useQuery<PolicyTemplateListResponse>({
    queryKey: ["policy-templates"],
    queryFn: () => policyTemplatesApi.list(),
  });

  const initMutation = useMutation({
    mutationFn: () =>
      api.post<Policy[]>(`/projects/${selectedProjectId}/policies/initialize`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies", selectedProjectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (policyId: string) =>
      api.delete(`/projects/${selectedProjectId}/policies/${policyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies", selectedProjectId] });
    },
  });

  const installMutation = useMutation({
    mutationFn: (slug: string) =>
      policyTemplatesApi.install(selectedProjectId!, { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies", selectedProjectId] });
    },
  });

  if (!selectedProjectId) {
    return <EmptyState icon={Shield} message="Select a project to manage policies." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="text-sm text-destructive p-4">
        Failed to load policies: {(error as Error).message}
      </div>
    );
  }

  const installedNames = new Set((policies ?? []).map((p) => p.name));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Policies"
        description="Evaluated in priority order (lowest number first)."
        meta={`${policies?.length ?? 0} ${policies?.length === 1 ? "rule" : "rules"}`}
      />

      <div className="flex items-center gap-1 border-b border-border" role="tablist">
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Active policies
        </TabButton>
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
          {templateData?.templates && (
            <span className="ml-2 text-xs text-muted-foreground">{templateData.templates.length}</span>
          )}
        </TabButton>
      </div>

      {tab === "active" && (
        <ActivePoliciesTab
          policies={policies ?? []}
          onInitialize={() => initMutation.mutate()}
          initializing={initMutation.isPending}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      {tab === "templates" && (
        <TemplatesTab
          response={templateData}
          error={templatesError as Error | null}
          installedNames={installedNames}
          installing={installMutation.isPending ? installMutation.variables ?? null : null}
          onInstall={(slug) => installMutation.mutate(slug)}
        />
      )}
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={props.active}
      onClick={props.onClick}
      className={`px-3 py-2 text-sm border-b-2 transition-colors ${
        props.active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {props.children}
    </button>
  );
}

function ActivePoliciesTab(props: {
  policies: Policy[];
  onInitialize: () => void;
  initializing: boolean;
  onDelete: (policyId: string) => void;
}) {
  if (props.policies.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState icon={Shield} message="No policies configured yet." />
        <div className="flex justify-center">
          <Button onClick={props.onInitialize} disabled={props.initializing}>
            <Plus className="mr-2 h-4 w-4" />
            {props.initializing ? "Initializing..." : "Initialize Default Policies"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card divide-y divide-border">
      {props.policies
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((policy) => {
          const effectStyle = EFFECT_STYLES[policy.effect] ?? EFFECT_STYLES.allow;
          return (
            <div
              key={policy.id}
              className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm truncate">{policy.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${effectStyle.bg} ${effectStyle.text}`}>
                    {effectStyle.label}
                  </span>
                  <span className="text-xs text-muted-foreground">Priority: {policy.priority}</span>
                  {!policy.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </div>
                {policy.description && (
                  <p className="text-xs text-muted-foreground mt-1">{policy.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{policy.actionPattern}</code>
                  {policy.conditions && (
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(policy.conditions).length} condition(s)
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">v{policy.version}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-8 w-8"
                onClick={() => {
                  if (confirm(`Delete policy "${policy.name}"?`)) {
                    props.onDelete(policy.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
    </div>
  );
}

function TemplatesTab(props: {
  response: PolicyTemplateListResponse | undefined;
  error: Error | null;
  installedNames: Set<string>;
  installing: string | null;
  onInstall: (slug: string) => void;
}) {
  if (props.error) {
    return <PolicyTemplateError message={`Failed to load templates: ${props.error.message}`} />;
  }

  if (!props.response) {
    return <PageSkeleton variant="list" />;
  }

  const { templates, errors } = props.response;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Browse the starter library and install the policies that fit your project. Each install creates a
        new <code className="text-xs">_starter_</code>-prefixed policy you can rename or edit afterwards.
      </p>

      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((err, idx) => (
            <PolicyTemplateError
              key={`${err.slug ?? "unknown"}-${idx}`}
              message={`${err.slug ?? "(unparsed)"}: ${err.error}`}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates.map((template) => {
          const installed = template.policies.some((p) => props.installedNames.has(p.name));
          return (
            <PolicyTemplateCard
              key={template.metadata.slug}
              template={template}
              installed={installed}
              installing={props.installing === template.metadata.slug}
              onInstall={() => props.onInstall(template.metadata.slug)}
            />
          );
        })}
      </div>
    </div>
  );
}
