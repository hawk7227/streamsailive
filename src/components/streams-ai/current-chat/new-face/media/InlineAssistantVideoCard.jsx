"use client";

import React from "react";

export default function InlineAssistantVideoCard({ video, onOpen, onDownload, onCopyUrl }) {
  const url = video?.url || video?.generatedVideoUrl || "";
  if (!url) return null;

  return (
    <figure className="streamsInlineMedia streamsInlineVideo" data-feature="video">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        onDoubleClick={onOpen}
        aria-label={video?.name || "Generated video"}
      >
        Your browser does not support the video tag.
      </video>
      <div className="streamsInlineMediaActions" aria-label="Video actions">
        {onOpen ? <button type="button" onClick={onOpen}>Open</button> : null}
        {onDownload ? <button type="button" onClick={onDownload}>Download</button> : null}
        {onCopyUrl ? <button type="button" onClick={onCopyUrl}>Copy link</button> : null}
      </div>
    </figure>
  );
}
