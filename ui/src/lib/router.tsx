import * as React from "react";
import * as RouterDom from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";
import { useProject } from "@/context/ProjectContext";
import {
  applyProjectPrefix,
  extractProjectPrefixFromPath,
  normalizeProjectPrefix,
} from "@/lib/project-routes";

function resolveTo(to: To, projectPrefix: string | null): To {
  if (typeof to === "string") {
    return applyProjectPrefix(to, projectPrefix);
  }

  if (to.pathname && to.pathname.startsWith("/")) {
    const pathname = applyProjectPrefix(to.pathname, projectPrefix);
    if (pathname !== to.pathname) {
      return { ...to, pathname };
    }
  }

  return to;
}

function useActiveProjectPrefix(): string | null {
  const { selectedProject } = useProject();
  const params = RouterDom.useParams<{ projectPrefix?: string }>();
  const location = RouterDom.useLocation();

  if (params.projectPrefix) {
    return normalizeProjectPrefix(params.projectPrefix);
  }

  const pathPrefix = extractProjectPrefixFromPath(location.pathname);
  if (pathPrefix) return pathPrefix;

  return selectedProject ? normalizeProjectPrefix(selectedProject.issuePrefix) : null;
}

export * from "react-router-dom";

export const Link = React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof RouterDom.Link>>(
  function ProjectLink({ to, ...props }, ref) {
    const projectPrefix = useActiveProjectPrefix();
    return <RouterDom.Link ref={ref} to={resolveTo(to, projectPrefix)} {...props} />;
  },
);

export const NavLink = React.forwardRef<HTMLAnchorElement, React.ComponentProps<typeof RouterDom.NavLink>>(
  function ProjectNavLink({ to, ...props }, ref) {
    const projectPrefix = useActiveProjectPrefix();
    return <RouterDom.NavLink ref={ref} to={resolveTo(to, projectPrefix)} {...props} />;
  },
);

export function Navigate({ to, ...props }: React.ComponentProps<typeof RouterDom.Navigate>) {
  const projectPrefix = useActiveProjectPrefix();
  return <RouterDom.Navigate to={resolveTo(to, projectPrefix)} {...props} />;
}

export function useNavigate(): ReturnType<typeof RouterDom.useNavigate> {
  const navigate = RouterDom.useNavigate();
  const projectPrefix = useActiveProjectPrefix();

  return React.useCallback(
    ((to: To | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        navigate(to);
        return;
      }
      navigate(resolveTo(to, projectPrefix), options);
    }) as ReturnType<typeof RouterDom.useNavigate>,
    [navigate, projectPrefix],
  );
}
