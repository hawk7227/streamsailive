"use client";

import AIAssistant from "@/components/dashboard/streams-assistant/AIAssistant";

export default function OldSettingPage() {
  return (
    <main className="oldSettingsShell">
      <section className="oldSettingsFrame">
        <header className="oldSettingsHeader">
          <div>
            <p>Streams Builder</p>
            <h1>Old Settings Panel</h1>
            <span>
              Preserved view of the old assistant settings panel. Click the gear icon inside the assistant card to open the API key/token inputs.
            </span>
          </div>
          <a href="/streams-ai/streams-builder">Back to Builder</a>
        </header>

        <div className="assistantWrap">
          <AIAssistant
            context={{
              type: "old-settings",
              prompt: "",
              settings: {},
              source: "streams-builder-oldsetting-route",
            }}
          />
        </div>
      </section>

      <style jsx>{`
        .oldSettingsShell {
          min-height: 100dvh;
          background: #020713;
          color: #f8fafc;
          padding: 28px;
          box-sizing: border-box;
        }

        .oldSettingsFrame {
          width: min(980px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .oldSettingsHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background: rgba(15, 23, 42, 0.82);
          padding: 22px;
        }

        .oldSettingsHeader p,
        .oldSettingsHeader h1,
        .oldSettingsHeader span {
          margin: 0;
        }

        .oldSettingsHeader p {
          color: #6ee7b7;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .oldSettingsHeader h1 {
          font-size: 28px;
        }

        .oldSettingsHeader span {
          display: block;
          color: #94a3b8;
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.5;
        }

        .oldSettingsHeader a {
          border: 1px solid rgba(139, 92, 246, 0.5);
          background: rgba(124, 58, 237, 0.18);
          color: #fff;
          border-radius: 12px;
          padding: 10px 14px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
        }

        .assistantWrap {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 22px;
          background: rgba(15, 23, 42, 0.82);
          padding: 18px;
        }
      `}</style>
    </main>
  );
}
