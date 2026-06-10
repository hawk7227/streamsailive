import type { StreamsBuilderTruthState } from "./types";
import type { StreamsBuilderProjectView } from "./projects";

export interface StreamsBuilderComponentMapRow {
  id: string;
  projectId: string;
  route: string | null;
  component: string | null;
  file: string | null;
  githubPath: string | null;
  truthState: StreamsBuilderTruthState;
  missing: string[];
}

function truthFor(project: StreamsBuilderProjectView, missing: string[]): StreamsBuilderTruthState {
  if (missing.length > 0) return "UNPROVEN";
  return project.proofState === "PROVEN" ? "PROVEN" : project.proofState || "UNKNOWN";
}

export function deriveComponentMap(projects: StreamsBuilderProjectView[], projectId?: string | null): StreamsBuilderComponentMapRow[] {
  const filtered = projectId ? projects.filter((project) => project.projectId === projectId) : projects;
  return filtered.map((project) => {
    const missing: string[] = [];
    if (!project.activeRoute) missing.push("route");
    if (!project.component) missing.push("component");
    if (!project.file) missing.push("file");
    if (!project.githubPath) missing.push("githubPath");
    return {
      id: `${project.projectId}:${project.activeRoute || "route-pending"}:${project.component || "component-pending"}`,
      projectId: project.projectId,
      route: project.activeRoute,
      component: project.component,
      file: project.file,
      githubPath: project.githubPath,
      truthState: truthFor(project, missing),
      missing,
    };
  });
}
