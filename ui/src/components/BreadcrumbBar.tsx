import { Link } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Fragment } from "react";

export function BreadcrumbBar() {
  const { breadcrumbs } = useBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  // Single breadcrumb = page title
  if (breadcrumbs.length === 1) {
    return (
      <span className="text-sm font-semibold tracking-wide truncate">
        {breadcrumbs[0].label}
      </span>
    );
  }

  // Multiple breadcrumbs = inline trail
  return (
    <Breadcrumb className="min-w-0 overflow-hidden">
      <BreadcrumbList className="flex-nowrap">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className={isLast ? "min-w-0" : "shrink-0"}>
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
