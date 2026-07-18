"use client";

import { PROJECT_CONTEXT_GROUPS } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

function ContextGroup({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <section className="contextGroup">
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export default function ProjectContextPanel() {
  const { state } = useProjectWorkspace();
  if (!state.projectPanelOpen) return null;

  return (
    <aside className="projectContextPanel" aria-label="Project context">
      <header><strong>Project Context</strong><span>{state.projectName}</span></header>
      <ContextGroup title="Project Overview" items={PROJECT_CONTEXT_GROUPS.overview} />
      <ContextGroup title="Files and Inputs" items={PROJECT_CONTEXT_GROUPS.filesAndInputs} />
      <ContextGroup title="Project Memory" items={PROJECT_CONTEXT_GROUPS.memory} />
      <ContextGroup title="Coding / Application Structure" items={PROJECT_CONTEXT_GROUPS.codingStructure} />
    </aside>
  );
}
