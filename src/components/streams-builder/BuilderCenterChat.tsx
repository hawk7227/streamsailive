"use client";

export default function BuilderCenterChat() {
  return (
    <section className="builderChatFrame" aria-label="Existing Streams AI mobile chat">
      <iframe title="Streams AI" src="/streams-ai?builderMode=1" />
      <style jsx>{`
        .builderChatFrame {
          width: min(100%, 430px);
          max-width: 430px;
          min-width: 320px;
          height: min(932px, calc(100dvh - 24px));
          min-height: 640px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          box-sizing: border-box;
        }
        iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #020713;
        }
      `}</style>
    </section>
  );
}
