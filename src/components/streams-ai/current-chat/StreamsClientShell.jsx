"use client";

import { useEffect, useState } from "react";
import StreamsOperatorShell from "../visual-operator/StreamsOperatorShell";
import { useStreamsChatRuntime } from "./new-face/hooks/useStreamsChatRuntime";
import ActualRecentChatsOverlay from "./ActualRecentChatsOverlay";
import ThreadAssetsHydrator from "./ThreadAssetsHydrator";
import StreamingRecoveryBanner from "./StreamingRecoveryBanner";
import MemoryControlsPanel from "./MemoryControlsPanel";
import { useAuth } from "@/contexts/AuthContext";

export default function StreamsClientShell() {
  const { session, loading } = useAuth();
  const [mounted, setMounted] = useState(true);
  const chatRuntime = useStreamsChatRuntime();

  useEffect(() => {
    if (!loading || session) {
      setMounted(true);
    }
  }, [session, loading]);

  if (!mounted) {
    return <main aria-label="Streams loading" style={{ minHeight: "100svh", background: "#080b18" }} />;
  }

  return (
    <>
      <StreamsOperatorShell chatRuntime={chatRuntime} />
      <ActualRecentChatsOverlay chatRuntime={chatRuntime} />
      <ThreadAssetsHydrator chatRuntime={chatRuntime} />
      <StreamingRecoveryBanner chatRuntime={chatRuntime} />
      <MemoryControlsPanel />
    </>
  );
}
