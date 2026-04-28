"use client";

import React from "react";
import ActivityGenerationCard, { type ActivityMode } from "@/components/streams/ActivityGenerationCard";
import type { ActivityPhase } from "@/lib/assistant-ui/activityConversations";
import "./ActivityConversation.css";

export type ActivityConversationProps = {
  phase: ActivityPhase;
  userText?: string;
  mode?: "chat" | "build" | "image" | "video" | "tool";
  active?: boolean;
  firstOutputVisible?: boolean;
  className?: string;
};

function modeFromPhase(phase: ActivityPhase, explicitMode?: ActivityConversationProps["mode"]): ActivityConversationProps["mode"] {
  if (explicitMode) return explicitMode;
  if (phase.startsWith("image_")) return "image";
  if (phase.startsWith("video_")) return "video";
  if (phase.startsWith("build_")) return "build";
  if (phase === "tool_running" || phase === "file_reading" || phase === "uploading" || phase === "saving") return "tool";
  return "chat";
}

function cardMode(mode: ActivityConversationProps["mode"]): ActivityMode {
  if (mode === "image") return "image";
  if (mode === "build") return "build";
  if (mode === "tool" || mode === "video") return "tool";
  return "conversation";
}

function cardCopy(phase: ActivityPhase, mode: ActivityConversationProps["mode"]): { label: string; title: string; subtitle: string } {
  if (mode === "image") {
    if (phase === "image_finalizing") {
      return {
        label: "IMAGE GENERATION",
        title: "Finalizing your image",
        subtitle: "Preparing the finished result for the chat.",
      };
    }
    return {
      label: "IMAGE GENERATION",
      title: "Generating your image",
      subtitle: "No dead screen — your image is being created.",
    };
  }

  if (mode === "video") {
    return {
      label: "VIDEO GENERATION",
      title: phase === "video_finalizing" ? "Finalizing your video" : "Generating your video",
      subtitle: "Keeping the session active while the output is prepared.",
    };
  }

  if (mode === "build") {
    const title =
      phase === "build_reviewing"
        ? "Reviewing your code"
        : phase === "build_writing"
          ? "Building your code"
          : "Preparing the build";
    return {
      label: "BUILDING",
      title,
      subtitle: "Preparing the implementation and output.",
    };
  }

  if (phase === "file_reading") {
    return {
      label: "FILE",
      title: "Reading your file",
      subtitle: "Extracting and analyzing the uploaded content.",
    };
  }

  return {
    label: "WORKING",
    title: "Running the requested action",
    subtitle: "Keeping the session active while the result is prepared.",
  };
}

function statusText(phase: ActivityPhase): string {
  switch (phase) {
    case "chat_streaming":
      return "Responding…";
    case "retrying":
      return "Retrying…";
    case "recovering":
      return "Recovering…";
    case "error":
      return "Something went wrong.";
    default:
      return "Thinking…";
  }
}

export function ActivityConversation({
  phase,
  mode,
  active = true,
  firstOutputVisible = false,
  className = "",
}: ActivityConversationProps) {
  if (!active || firstOutputVisible || phase === "idle" || phase === "done") {
    return null;
  }

  const resolvedMode = modeFromPhase(phase, mode);

  // Conversation waits must use the small ChatGPT-style status row, not the old card.
  if (resolvedMode === "chat" || phase === "chat_thinking" || phase === "chat_streaming") {
    return (
      <div
        className={["activity-conversation-status", className].filter(Boolean).join(" ")}
        role="status"
        aria-live="polite"
        aria-busy={phase !== "error"}
      >
        {statusText(phase)}
      </div>
    );
  }

  const copy = cardCopy(phase, resolvedMode);

  return (
    <div
      className={["activity-conversation-replacement", className].filter(Boolean).join(" ")}
      aria-live="polite"
      aria-busy={phase !== "error"}
    >
      <ActivityGenerationCard
        mode={cardMode(resolvedMode)}
        label={copy.label}
        title={copy.title}
        subtitle={copy.subtitle}
        compact
      />
    </div>
  );
}

export default ActivityConversation;
