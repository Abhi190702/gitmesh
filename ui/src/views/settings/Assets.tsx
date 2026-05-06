import { useEffect } from "react";
import { Image as ImageIcon } from "lucide-react";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useBreadcrumbs } from "../../context/BreadcrumbContext";

export function Assets() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Assets" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configure"
        title="Assets"
        description="Static files and images referenced by agents and playbooks."
      />
      <EmptyState
        icon={ImageIcon}
        eyebrow="Coming soon"
        message="Asset library on the way."
        description="Upload, version, and reference image and file assets from agent runs."
      />
    </div>
  );
}
