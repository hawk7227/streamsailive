"use client";

import { useEffect } from "react";
import { installStreamsBuilderModeBridge } from "@/components/streams-ai/current-chat/runtime/streamsBuilderModeBridge";

export default function StreamsAIBuilderModeBridge() {
  useEffect(() => installStreamsBuilderModeBridge(), []);
  return null;
}
