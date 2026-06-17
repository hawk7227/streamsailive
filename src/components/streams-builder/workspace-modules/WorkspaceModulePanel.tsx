"use client";

import EnvReadinessMonitor from "../EnvReadinessMonitor";

export type WorkspaceModuleName =
  | "Primary Builder"
  | "Visual Editing"
  | "Component Mapping"
  | "Approval Center"
  | "Browser Verification"
  | "Repository Truth"
  | "Projects Dashboard"
  | "Truth Panel";

const MODULE_COPY: Record<WorkspaceModuleName, string> = {
  "Primary Builder": "Build. Preview. Prove.",
  "Visual Editing": "Drag. Drop. Style.",
  "Component Mapping": "Map. Bind. Connect.",
  "Approval Center": "Review. Approve. Ship.",
  "Browser Verification": "Test. Verify. Validate.",
  "Repository Truth": "Truth. Diff. History.",
  "Projects Dashboard": "Overview. Track. Report.",
  "Truth Panel": "Proven. Verified. Trusted.",
};

export default function WorkspaceModulePanel({
  moduleName,
}: {
  moduleName: WorkspaceModuleName;
}) {
  return (
    <section className="streamsModulePanel">
      <header>
        <b>{moduleName}</b>
        <span>{MODULE_COPY[moduleName]}</span>
      </header>

      <p>This compact module stays under the workstation and does not replace the main builder screen.</p>

      <div className="monitorSlot">
        <EnvReadinessMonitor />
      </div>

      <style jsx>{`
        .streamsModulePanel {
          margin-top: 8px;
          border: 1px solid rgba(16, 185, 129, 0.18);
          border-radius: 10px;
          background: rgba(6, 78, 59, 0.08);
          color: #fff;
          padding: 8px;
          font-size: 10px;
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        b {
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        span,
        p {
          color: #cbd5e1;
          margin: 4px 0 0;
        }

        .monitorSlot {
          margin-top: 10px;
        }
      `}</style>
    </section>
  );
}
