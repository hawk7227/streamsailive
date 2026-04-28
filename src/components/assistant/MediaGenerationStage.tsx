"use client";

import React from "react";
import ActivityGenerationCard from "@/components/streams/ActivityGenerationCard";
import "./MediaGenerationStage.css";

export type MediaGenerationKind = "image" | "video";
export type MediaGenerationState =
  | "starting"
  | "queued"
  | "generating"
  | "finalizing"
  | "complete"
  | "error";

export type MediaGenerationStageProps = {
  kind: MediaGenerationKind;
  state: MediaGenerationState;
  message?: string;
  detail?: string;
  active?: boolean;
  outputUrl?: string | null;
  className?: string;
};

function defaultCopy(kind: MediaGenerationKind, state: MediaGenerationState): { label: string; title: string; subtitle: string } {
  if (kind === "image") {
    return {
      label: state === "error" ? "IMAGE ERROR" : "IMAGE GENERATION",
      title: state === "finalizing" ? "Finalizing your image" : state === "error" ? "The image did not finish" : "Generating your image",
      subtitle: state === "error" ? "The issue will be shown clearly instead of pretending it worked." : "No dead screen — your image is being created.",
    };
  }

  return {
    label: state === "error" ? "VIDEO ERROR" : "VIDEO GENERATION",
    title: state === "finalizing" ? "Finalizing your video" : state === "error" ? "The video did not finish" : "Generating your video",
    subtitle: state === "error" ? "The issue will be shown clearly instead of pretending it worked." : "Keeping the session active while the output is prepared.",
  };
}

export function MediaGenerationStage({
  kind,
  state,
  message,
  detail,
  active = true,
  outputUrl,
  className = "",
}: MediaGenerationStageProps) {
  if (!active && !outputUrl) return null;

  const showOutput = Boolean(outputUrl && state === "complete");
  const copy = defaultCopy(kind, state);

  return (
    <section
      className={["media-generation-stage", `media-generation-stage--${kind}`, `media-generation-stage--${state}`, className]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-busy={!showOutput && state !== "error"}
    >
      {showOutput ? (
        kind === "image" ? (
          <img className="media-generation-stage__output" src={outputUrl ?? ""} alt="Generated result" />
        ) : (
          <video className="media-generation-stage__output" src={outputUrl ?? ""} controls playsInline />
        )
      ) : (
        <ActivityGenerationCard
          mode={kind === "image" ? "image" : "tool"}
          label={copy.label}
          title={message ?? copy.title}
          subtitle={detail ?? copy.subtitle}
        />
      )}
    </section>
  );
}

export default MediaGenerationStage;
