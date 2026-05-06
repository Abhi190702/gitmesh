import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { AttestationStatusKind } from "../api/attestations";

interface AttestationBadgeProps {
  projectId: string;
  activityId: string;
  status: AttestationStatusKind | undefined;
  size?: "xs" | "sm";
}

/**
 * Inline badge for the audit log. The caller resolves status (typically
 * via a single bulk lookup for the whole list) and passes it in. Renders
 * one of:
 *   - green shield-check + "attested"
 *   - amber shield-question + "pending"
 *   - dimmed shield-alert + "missing"
 *
 * Click opens the canonical verification URL in a new tab so an
 * operator can hand it to a third-party verifier.
 */
export function AttestationBadge({ projectId, activityId, status, size = "xs" }: AttestationBadgeProps) {
  const sizeClass = size === "xs" ? "h-3 w-3" : "h-4 w-4";
  const verifyUrl = `/api/projects/${projectId}/attestations/${activityId}`;

  if (status === undefined) {
    return <span className={`inline-block ${sizeClass} rounded-full bg-muted/40`} aria-label="loading attestation" />;
  }

  if (status === "attested") {
    return (
      <a
        href={verifyUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-400 transition-colors"
        title="Click to view the signed attestation (Ed25519, project-scoped)."
      >
        <ShieldCheck className={sizeClass} />
        <span className="text-[10px] uppercase tracking-wide">attested</span>
      </a>
    );
  }

  if (status === "pending") {
    return (
      <span
        className="inline-flex items-center gap-1 text-amber-500"
        title="Attestation queued; the project signing worker will pick it up shortly."
      >
        <ShieldQuestion className={sizeClass} />
        <span className="text-[10px] uppercase tracking-wide">pending</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground/60"
      title="No attestation recorded for this row. (Pre-attestation history or a worker failure.)"
    >
      <ShieldAlert className={sizeClass} />
    </span>
  );
}
