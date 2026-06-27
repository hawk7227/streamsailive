"use client";

import { useEffect } from "react";
import { installStreamsBuilderBridgeProof } from "@/components/streams-ai/current-chat/runtime/streamsBuilderBridgeProof";

export default function StreamsAIBuilderProofBridge() {
  useEffect(() => installStreamsBuilderBridgeProof(), []);
  return null;
}
