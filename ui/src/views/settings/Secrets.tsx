import { useEffect } from "react";
import { KeyRound } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";

export function Secrets() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Secrets" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configure"
        title="Secrets"
        description="API keys and tokens used by adapters."
      />
      <EmptyState
        icon={KeyRound}
        eyebrow="Coming soon"
        message="Secrets vault on the way."
        description="The encrypted secret store will land in a near-term phase. For now, set environment variables on the host or use a secret reference in agent config."
      />
    </div>
  );
}
