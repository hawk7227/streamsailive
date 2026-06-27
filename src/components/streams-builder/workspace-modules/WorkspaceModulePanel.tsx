"use client";

import EnvReadinessMonitor from "../EnvReadinessMonitor";
import { VISUAL_EDITOR_BUILD_GROUPS } from "@/lib/streams-builder/visual-editor-build-groups";

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

function VisualEditorRobustGroups() {
  return (
    <section className="robustGroups">
      <b>Safe grouped build 1-15</b>
      <div className="groupGrid">
        {VISUAL_EDITOR_BUILD_GROUPS.map((group) => (
          <article key={group.id} className="groupCard">
            <strong>{group.title}</strong>
            <small>{group.items.map((item) => item.id).join(", ")}</small>
            <p>{group.safeBuildReason}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}><span>{item.id}</span>{item.title}<em>{item.status}</em></li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

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

      {moduleName === "Visual Editing" || moduleName === "Component Mapping" || moduleName === "Approval Center" ? <VisualEditorRobustGroups /> : null}

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

        .robustGroups {
          margin-top: 8px;
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 10px;
          padding: 8px;
          background: rgba(15, 23, 42, 0.6);
        }

        .groupGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 6px;
          margin-top: 6px;
        }

        .groupCard {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 9px;
          background: rgba(2, 6, 23, 0.58);
          padding: 7px;
        }

        strong {
          display: block;
          color: #fff;
          font-size: 10px;
          line-height: 1.2;
        }

        small {
          display: block;
          color: #93c5fd;
          font-size: 9px;
          margin-top: 3px;
        }

        .groupCard p {
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.25;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 6px 0 0;
          display: grid;
          gap: 4px;
        }

        li {
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr) auto;
          gap: 4px;
          align-items: center;
          color: #cbd5e1;
          font-size: 9px;
          line-height: 1.15;
        }

        li span {
          display: inline-grid;
          place-items: center;
          width: 14px;
          height: 14px;
          margin: 0;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.16);
          color: #6ee7b7;
          font-size: 8px;
          font-weight: 900;
        }

        em {
          color: #fbbf24;
          font-style: normal;
          font-size: 8px;
          text-transform: uppercase;
        }

        .monitorSlot {
          margin-top: 10px;
        }
      `}</style>
    </section>
  );
}
