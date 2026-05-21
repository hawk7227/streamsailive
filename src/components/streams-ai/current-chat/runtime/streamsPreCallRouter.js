export function isStreamsBackendProofIntent(message = "") {
  const text = String(message || "").trim().toLowerCase();

  if (!text) return false;

  return (
    /\b(streams|backend|approved backend|tool job|tool_call|toolcallid|jobid|job status|persisted job|persisted state)\b/.test(text) ||
    /\b(provider[_\s-]?runs?|provider run records?|provider execution|storage upload|asset row|output asset|worker pickup|final preview rendering|stored output|proof chain)\b/.test(text) ||
    /\b(prove|proof|unproven|do not guess|do not only explain|use persisted|use the approved backend tool|what is still unproven)\b/.test(text)
  );
}

export function detectPreCallRoute(message = "") {
  const text = String(message || "").trim().toLowerCase();

  if (!text) {
    return { mode: "chat", reason: "empty" };
  }

  if (isStreamsBackendProofIntent(text)) {
    return { mode: "chat", reason: "streams_backend_proof_or_tool_job_intent" };
  }

  const imageIntent = /\b(generate|create|make|draw|render|produce|design)\b[\s\S]{0,120}\b(image|photo|picture|visual|graphic|art|logo|thumbnail|banner)\b/.test(text) ||
    /\b(image|photo|picture|visual|graphic|art|logo|thumbnail|banner)\b[\s\S]{0,120}\b(generate|create|make|draw|render|produce|design)\b/.test(text) ||
    text.startsWith("image of ") ||
    text.startsWith("photo of ") ||
    text.startsWith("picture of ") ||
    text.includes(" ai image") ||
    text.includes(" generated image");

  const videoIntent = /\b(generate|create|make|render|produce|turn|animate)\b[\s\S]{0,120}\b(video|clip|film|animation|motion)\b/.test(text) ||
    /\b(video|clip|film|animation|motion)\b[\s\S]{0,120}\b(generate|create|make|render|produce|turn|animate)\b/.test(text);

  if (imageIntent && !videoIntent) {
    return { mode: "image", reason: "local_image_intent" };
  }

  if (videoIntent) {
    return { mode: "video", reason: "local_video_intent" };
  }

  if (
    text.includes("react component") ||
    text.includes("build a component") ||
    text.includes("preview card") ||
    text.includes("fenced jsx code") ||
    text.includes("open preview") ||
    text.includes("code block")
  ) {
    return { mode: "artifact", reason: "local_artifact_intent" };
  }

  return { mode: "chat", reason: "default_chat" };
}
