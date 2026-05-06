import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { useProject } from "../context/ProjectContext";
import { toProjectRelativePath } from "../lib/project-routes";

const STORAGE_KEY = "gitmesh-agents.projectPaths";
const GLOBAL_SEGMENTS = new Set(["auth", "invite", "board-claim", "docs"]);

function getProjectPaths(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveProjectPath(projectId: string, path: string) {
  const paths = getProjectPaths();
  paths[projectId] = path;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

function isRememberableProjectPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return true;
  const [root] = segments;
  if (GLOBAL_SEGMENTS.has(root!)) return false;
  return true;
}

/**
 * Remembers the last visited page per project and navigates to it on project switch.
 * Falls back to /dashboard if no page was previously visited for a project.
 */
export function useProjectPageMemory() {
  const { selectedProjectId, selectedProject, selectionSource } = useProject();
  const location = useLocation();
  const navigate = useNavigate();
  const prevProjectId = useRef<string | null>(selectedProjectId);

  // Save current path for current project on every location change.
  // Uses prevProjectId ref so we save under the correct project even
  // during the render where selectedProjectId has already changed.
  const fullPath = location.pathname + location.search;
  useEffect(() => {
    const projectId = prevProjectId.current;
    const relativePath = toProjectRelativePath(fullPath);
    if (projectId && isRememberableProjectPath(relativePath)) {
      saveProjectPath(projectId, relativePath);
    }
  }, [fullPath]);

  // Navigate to saved path when project changes
  useEffect(() => {
    if (!selectedProjectId) return;

    if (
      prevProjectId.current !== null &&
      selectedProjectId !== prevProjectId.current
    ) {
      if (selectionSource !== "route_sync" && selectedProject) {
        const paths = getProjectPaths();
        const savedPath = paths[selectedProjectId];
        const relativePath = savedPath ? toProjectRelativePath(savedPath) : "/dashboard";
        const targetPath = isRememberableProjectPath(relativePath) ? relativePath : "/dashboard";
        navigate(`/${selectedProject.issuePrefix}${targetPath}`, { replace: true });
      }
    }
    prevProjectId.current = selectedProjectId;
  }, [selectedProject, selectedProjectId, selectionSource, navigate]);
}
