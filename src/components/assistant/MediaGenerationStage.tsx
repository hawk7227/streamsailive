import React from "react";
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

const defaultCopy: Record<MediaGenerationKind, Record<MediaGenerationState, { message: string; detail: string }>> = {
  image: {
    starting: {
      message: "I’m starting your image now",
      detail: "I’ll keep the preview space alive while it takes shape.",
    },
    queued: {
      message: "Your image is lined up",
      detail: "It’s waiting to begin, and I’ll keep watching it.",
    },
    generating: {
      message: "Your image is taking shape",
      detail: "I’m keeping the look close to what you asked for.",
    },
    finalizing: {
      message: "Almost ready",
      detail: "I’m getting the image ready to show here.",
    },
    complete: {
      message: "Image ready",
      detail: "Take a look.",
    },
    error: {
      message: "The image didn’t finish",
      detail: "I’ll show the issue clearly instead of pretending it worked.",
    },
  },
  video: {
    starting: {
      message: "I’m starting your video now",
      detail: "This preview space will stay active while it gets moving.",
    },
    queued: {
      message: "Your video is lined up",
      detail: "It’s waiting to begin, and I’ll keep you posted.",
    },
    generating: {
      message: "Your video is coming together",
      detail: "I’m watching for the moment it’s ready to preview.",
    },
    finalizing: {
      message: "Almost ready",
      detail: "I’m preparing the player here.",
    },
    complete: {
      message: "Video ready",
      detail: "Press play when you’re ready.",
    },
    error: {
      message: "The video didn’t finish",
      detail: "I’ll show the issue clearly instead of going silent.",
    },
  },
};

export function MediaGenerationStage({
  kind,
  state,
  message,
  detail,
  active = true,
  outputUrl,
  className = "",
}: MediaGenerationStageProps) {
  const copy = defaultCopy[kind][state];

  if (!active && !outputUrl) return null;

  const showOutput = Boolean(outputUrl && state === "complete");

  return (
    <section
      className={[
        "media-generation-stage",
        `media-generation-stage--${kind}`,
        `media-generation-stage--${state}`,
        className,
      ].join(" ")}
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
        <div className="media-generation-stage__animation" aria-hidden="true">
          <div className="media-generation-stage__burst" />
          <div className="media-generation-stage__rings" />
          <div className="media-generation-stage__mesh" />
          {kind === "video" && (
            <div className="media-generation-stage__timeline">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      )}

      {!showOutput && (
        <div className="media-generation-stage__copy">
          <p className="media-generation-stage__message">{message ?? copy.message}</p>
          <p className="media-generation-stage__detail">{detail ?? copy.detail}</p>
        </div>
      )}
    </section>
  );
}

export default MediaGenerationStage;
