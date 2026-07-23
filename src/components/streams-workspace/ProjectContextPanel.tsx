"use client";

import { PROJECT_CONTEXT_GROUPS } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

function ContextGroup({ title, items, emptyItems }: { title: string; items: readonly string[]; emptyItems?: readonly string[] }) {
  const visible = items.length ? items : emptyItems || [];
  return (
    <section className="contextGroup">
      <h3>{title}</h3>
      <ul>{visible.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function fileLabel(file: Record<string, unknown>, index: number) {
  return String(file.name || file.path || file.filename || file.id || `Project file ${index + 1}`);
}

export default function ProjectContextPanel() {
  const { state } = useProjectWorkspace();
  if (!state.projectPanelOpen) return null;

  const overview = [
    `Goal: ${state.projectGoal}`,
    `Audience: ${state.projectAudience}`,
    `Status: ${state.projectStatus}`,
    `Description: ${state.projectDescription}`,
    `Instructions: ${state.projectInstructions}`,
    `Brand / style: ${state.projectStyle}`,
  ];
  const files = state.projectFiles.map(fileLabel);
  const memory = [
    ...state.projectDecisions.map((item) => `Decision: ${item}`),
    ...state.projectRequirements.map((item) => `Requirement: ${item}`),
    ...state.projectConstraints.map((item) => `Constraint: ${item}`),
    ...(state.originalPrompt ? [`Original prompt: ${state.originalPrompt}`] : []),
  ];
  const codingStructure = [
    `Workspace type: ${state.projectType}`,
    `Project ID: ${state.projectId || "Restoring"}`,
    `Current stage: ${state.currentStage}`,
    `Progress: ${state.progress}%`,
    `Next action: ${state.nextAction}`,
    ...PROJECT_CONTEXT_GROUPS.codingStructure,
  ];

  return (
    <aside className="projectContextPanel" aria-label="Project context">
      <header><strong>Project Context</strong><span>{state.projectName}</span></header>
      <ContextGroup title="Project Overview" items={overview} />
      <ContextGroup title="Files and Inputs" items={files} emptyItems={PROJECT_CONTEXT_GROUPS.filesAndInputs} />
      <ContextGroup title="Project Memory" items={memory} emptyItems={PROJECT_CONTEXT_GROUPS.memory} />
      <ContextGroup title="Project Structure" items={codingStructure} />
    </aside>
  );
}
