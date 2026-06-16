"use client";

import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkstationChromeEnhancer from "./WorkstationChromeEnhancer";

export default function WorkspaceGrid() {
  return (
    <main className="streamsBuilderShell">
      <section className="centerWorkspace">
        <GitHubRepositoryPicker />
        <WorkstationChromeEnhancer />
      </section>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .centerWorkspace {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: auto;
          box-sizing: border-box;
          padding: 6px;
        }
      `}</style>
    </main>
  );
}
