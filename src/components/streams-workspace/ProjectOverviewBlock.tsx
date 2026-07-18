"use client";

import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function ProjectOverviewBlock() {
  const { state } = useProjectWorkspace();
  return (
    <section className="projectOverviewBlock" aria-label="Project overview">
      <div><span>Project Goal</span><strong>Preserve and combine the complete Streams Builder capability set</strong></div>
      <div><span>Current Stage</span><strong>{state.currentStage}</strong></div>
      <div><span>Progress</span><strong>{state.progress}%</strong></div>
      <div><span>Next Recommended Action</span><strong>{state.nextAction}</strong></div>
    </section>
  );
}
