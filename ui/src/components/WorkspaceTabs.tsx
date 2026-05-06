import { Link } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

export function WorkspaceTabs() {
  const { breadcrumbs } = useBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  if (breadcrumbs.length === 1) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
        {breadcrumbs[0]!.label}
      </span>
    );
  }

  const section = breadcrumbs[0]!;
  const subCrumbs = breadcrumbs.slice(1);

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden font-mono text-[11px] uppercase tracking-[0.18em]">
      {section.href ? (
        <Link to={section.href} className="text-text-secondary transition-colors hover:text-foreground">
          {section.label}
        </Link>
      ) : (
        <span className="text-text-secondary">{section.label}</span>
      )}
      {subCrumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-text-tertiary/50 select-none">/</span>
          {crumb.href ? (
            <Link
              to={crumb.href}
              className="truncate max-w-[12rem] text-text-secondary transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="truncate max-w-[16rem] text-foreground normal-case tracking-normal font-sans text-sm font-medium">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
