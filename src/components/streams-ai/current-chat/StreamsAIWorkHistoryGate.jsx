"use client";

import { useLayoutEffect, useState } from "react";
import StreamsAIWorkHistoryBridge from "./StreamsAIWorkHistoryBridge";

const STORAGE_KEY = "streams-ai.active-work-job.v1";

export default function StreamsAIWorkHistoryGate() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setReady(true);
  }, []);

  return ready ? <StreamsAIWorkHistoryBridge /> : null;
}
