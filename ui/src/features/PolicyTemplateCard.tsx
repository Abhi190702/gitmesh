import { Shield, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PolicyTemplate } from "../api/policy-templates";

interface PolicyTemplateCardProps {
  template: PolicyTemplate;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
}

const EFFECT_STYLES: Record<string, string> = {
  allow: "bg-emerald-500/10 text-emerald-400",
  block: "bg-red-500/10 text-red-400",
  require_approval: "bg-amber-500/10 text-amber-400",
};

export function PolicyTemplateCard({ template, installed, installing, onInstall }: PolicyTemplateCardProps) {
  const effects = Array.from(new Set(template.policies.map((p) => p.effect)));

  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {installed ? (
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <h3 className="font-medium text-sm truncate" title={template.metadata.title}>
            {template.metadata.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {effects.map((effect) => (
            <span
              key={effect}
              className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${EFFECT_STYLES[effect] ?? ""}`}
            >
              {effect.replace("_", " ")}
            </span>
          ))}
          {template.metadata.defaultEnabled && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
              default
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{template.metadata.whatItDoes}</p>

      {template.metadata.whatItProtects && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            What this protects
          </summary>
          <p className="mt-1 pl-2 border-l border-border text-muted-foreground">
            {template.metadata.whatItProtects}
          </p>
        </details>
      )}

      {template.metadata.auditExample && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Audit example
          </summary>
          <pre className="mt-1 p-2 bg-muted rounded text-[11px] whitespace-pre-wrap font-mono text-muted-foreground">
{template.metadata.auditExample}
          </pre>
        </details>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-muted-foreground">
          {template.policies.length === 1
            ? "1 policy"
            : `${template.policies.length} policies`}
        </span>
        <Button
          size="sm"
          variant={installed ? "ghost" : "default"}
          disabled={installing}
          onClick={onInstall}
          aria-label={installed ? `Reinstall ${template.metadata.title}` : `Install ${template.metadata.title}`}
        >
          {installing ? "Installing..." : installed ? "Reinstall" : "Install"}
        </Button>
      </div>
    </div>
  );
}

export function PolicyTemplateError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}
