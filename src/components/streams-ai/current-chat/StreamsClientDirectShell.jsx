"use client";

import { Component } from "react";
import StreamsOperatorShell from "../visual-operator/StreamsOperatorShell";
import { useStreamsChatRuntime } from "./new-face/hooks/useStreamsChatRuntime";
import ActualRecentChatsOverlay from "./ActualRecentChatsOverlay";
import ComposerDraftPersistence from "./ComposerDraftPersistence";
import ThreadAssetsHydrator from "./ThreadAssetsHydrator";
import StreamingRecoveryBanner from "./StreamingRecoveryBanner";
import MemoryControlsPanel from "./MemoryControlsPanel";
import StreamsBuilderPreviewHost from "./StreamsBuilderPreviewHost";
import StreamsBuilderPreviewController from "./StreamsBuilderPreviewController";

class StreamsDirectErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[streams-ai-direct-shell] render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main
          style={{
            minHeight: "100dvh",
            background: "#080b18",
            color: "#e5edff",
            display: "grid",
            placeItems: "center",
            padding: 24,
            fontFamily: "Inter, ui-sans-serif, system-ui",
          }}
        >
          <section
            style={{
              width: "min(560px, 100%)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              borderRadius: 20,
              background: "rgba(15, 23, 42, 0.72)",
              padding: 22,
              boxShadow: "0 22px 80px rgba(0,0,0,0.35)",
            }}
          >
            <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Streams AI could not finish opening.</h1>
            <p style={{ margin: 0, color: "rgba(226, 232, 240, 0.78)", lineHeight: 1.5 }}>
              The page loaded, but one of the workspace panels crashed while rendering. Check the browser Console for the exact error.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function StreamsDirectContent() {
  const chatRuntime = useStreamsChatRuntime();

  return (
    <>
      <StreamsOperatorShell chatRuntime={chatRuntime} />
      <ActualRecentChatsOverlay chatRuntime={chatRuntime} />
      <ComposerDraftPersistence chatRuntime={chatRuntime} />
      <ThreadAssetsHydrator chatRuntime={chatRuntime} />
      <StreamingRecoveryBanner chatRuntime={chatRuntime} />
      <MemoryControlsPanel />
      <StreamsBuilderPreviewController chatRuntime={chatRuntime} />
      <StreamsBuilderPreviewHost chatRuntime={chatRuntime} />
    </>
  );
}

export default function StreamsClientDirectShell() {
  return (
    <StreamsDirectErrorBoundary>
      <StreamsDirectContent />
    </StreamsDirectErrorBoundary>
  );
}
