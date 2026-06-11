import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";

export const dynamic = "force-dynamic";

export default function StreamsBuilderPage() {
  return (
    <main className="streamsBuilderPage">
      <header className="streamsBuilderHeader">
        <div className="streamsBuilderMark" aria-hidden="true">◆</div>
        <div>
          <h1>STREAMS BUILDER</h1>
          <p>Intelligent Build Operating System</p>
        </div>
      </header>
      <section className="streamsBuilderWorkspaceShell" aria-label="Streams Builder workspace">
        <WorkspaceGrid />
      </section>

      <style jsx global>{`
        html,
        body {
          background: #020713;
        }

        .streamsBuilderPage {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          background:
            radial-gradient(circle at 82% -10%, rgba(124, 58, 237, 0.12), transparent 28%),
            #020713;
          color: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .streamsBuilderHeader {
          height: 30px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.1);
          background: rgba(2, 6, 23, 0.96);
        }

        .streamsBuilderMark {
          width: 16px;
          height: 16px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: rgba(124, 58, 237, 0.25);
          color: #8b5cf6;
          font-size: 10px;
          line-height: 1;
        }

        .streamsBuilderHeader h1 {
          margin: 0;
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.02em;
        }

        .streamsBuilderHeader p {
          margin: 1px 0 0;
          color: #93c5fd;
          font-size: 8px;
          line-height: 1;
        }

        .streamsBuilderWorkspaceShell {
          height: calc(100dvh - 30px);
          min-height: 0;
          padding: 0;
          overflow: hidden;
        }

        .sb-panel {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(8, 13, 28, 0.96);
          box-shadow: 0 14px 42px rgba(0, 0, 0, 0.22);
        }

        .sb-btn {
          height: 30px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 9px;
          background: rgba(15, 23, 42, 0.9);
          color: #fff;
          padding: 0 12px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .sb-btn.primary {
          border-color: rgba(139, 92, 246, 0.65);
          background: linear-gradient(135deg, #6d28d9, #8b5cf6);
        }

        .sb-btn.red {
          border-color: rgba(239, 68, 68, 0.58);
          background: rgba(127, 29, 29, 0.42);
        }
      `}</style>
    </main>
  );
}
