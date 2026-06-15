"use client";

import { useState } from "react";
import VisualEditingWorkstation from "./VisualEditingWorkstation";

export default function AgentOneWorkstation() {
  const [content, setContent] = useState("");
  const [proofLog, setProofLog] = useState<string[]>([]);
  const [chatLog, setChatLog] = useState<string[]>([]);

  return (
    <section className="agentOneWorkstation" aria-label="Agent 1 workstation">
      <VisualEditingWorkstation
        stationLabel="Agent 1"
        route="/"
        filePath="src/app/about/page.tsx"
        repo="hawk7227/streamsailive"
        branch="main"
        content={content}
        onContentChange={setContent}
        onProof={(message) => setProofLog((items) => [...items.slice(-12), message])}
        onChat={(message) => setChatLog((items) => [...items.slice(-8), message])}
      />

      <style jsx>{`
        .agentOneWorkstation {
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }
      `}</style>
    </section>
  );
}
