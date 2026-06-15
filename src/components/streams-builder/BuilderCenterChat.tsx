"use client";

import BuilderExistingChatMount from "./BuilderExistingChatMount";

export default function BuilderCenterChat() {
  return (
    <section className="builderChatFrame" aria-label="Existing Streams AI mobile chat">
      <BuilderExistingChatMount />
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
      `}</style>
    </section>
  );
}
