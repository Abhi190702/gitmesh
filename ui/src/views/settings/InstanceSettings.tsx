import { useEffect } from "react";
import { Server } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";

export function InstanceSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Instance Settings" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Instance"
        description="Settings that span the entire installation."
      />
      <EmptyState
        icon={Server}
        eyebrow="Coming soon"
        message="Instance-wide settings."
        description="Cross-project deployment configuration, including auth, telemetry, and feature gates."
      />
    </div>
  );
}
