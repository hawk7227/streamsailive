import { canShowStreamsStatus, normalizeStatusText } from "./streamsStatusRegistry";

const ACTIVITY_LABELS = {
  chat: {
    created: ["Thinking…", "The request was accepted."],
    thinking: ["Thinking…", "The request is being prepared."],
    understanding: ["Understanding your request…", "Streams is identifying the requested outcome."],
    reviewing: ["Reviewing your request…", "Relevant context is being reviewed."],
    preparing: ["Preparing response…", "The response is being prepared."],
    starting: ["Writing…", "The response is being prepared."],
    streaming: ["Writing…", "The answer is streaming."],
    complete: ["Ready", "The response is ready."],
    error: ["Something went wrong", "The request did not complete successfully."],
    cancelled: ["Request cancelled", "The active response was cancelled."],
  },
  file: {
    starting: ["Uploading…", "The attachment is being prepared."],
    thinking: ["Uploading…", "The attachment is being prepared."],
    uploading: ["Uploading…", "The attachment is being uploaded."],
    reading: ["Reading attached file…", "The attachment is being read."],
    reviewing: ["Reviewing uploaded files…", "Relevant uploaded content is being reviewed."],
    extracting: ["Text extracted", "Readable attachment text is available."],
    complete: ["Files ready", "The file is ready."],
    error: ["Upload failed", "The upload did not complete successfully."],
  },
  image: {
    understanding: ["Preparing image request…", "Streams is determining the requested image operation."],
    reviewing: ["Checking the reference image…", "The supplied visual reference is being inspected."],
    preparing: ["Preparing image request…", "The image request is being prepared."],
    checking: ["Checking image request…", "The request and applicable settings are being validated."],
    starting: ["Starting image generation…", "The image job is starting."],
    rendering: ["Generating image…", "Your image is actively being created."],
    polling: ["Receiving preview…", "Streams is waiting for the latest image output."],
    saving: ["Saving image…", "The completed image is being saved."],
    complete: ["Image ready", "Your generated image is ready."],
    error: ["Image failed", "The image request did not complete successfully."],
    cancelled: ["Request cancelled", "The image request was cancelled."],
  },
  video: {
    preparing: ["Preparing video request…", "The video request is being prepared."],
    starting: ["Starting video generation…", "The video job is starting."],
    rendering: ["Rendering video…", "Your video is actively being created."],
    polling: ["Rendering video…", "Streams is waiting for the latest video output."],
    frames: ["Sampling frames…", "Video frame sampling is active."],
    saving: ["Saving video…", "The completed video is being saved."],
    complete: ["Video ready", "Your generated video is ready."],
    error: ["Video failed", "The video request did not complete successfully."],
    cancelled: ["Request cancelled", "The video request was cancelled."],
  },
  audio: {
    starting: ["Transcribing audio…", "Audio transcription is active."],
    transcribing: ["Transcribing audio…", "Audio transcription is active."],
    complete: ["Files ready", "The audio file is ready."],
    error: ["Upload failed", "The audio request failed."],
  },
  tool: {
    starting: ["Searching the web…", "The web search is starting."],
    thinking: ["Searching the web…", "The web search is running."],
    searching: ["Searching sources…", "Streams is locating relevant sources."],
    opening: ["Opening source…", "A selected source is being opened."],
    reading: ["Reading source…", "The selected source is being reviewed."],
    reviewing: ["Reviewing sources…", "The collected sources are being compared."],
    citations: ["Checking citations…", "Source references are being checked."],
    received: ["Received app response", "A connected tool response was received."],
    complete: ["Search complete", "The web search is complete."],
    error: ["Search failed", "The web search did not complete successfully."],
  },
  build: {
    starting: ["Planning build…", "The build request is being prepared."],
    reading: ["Reading repository…", "The repository is being inspected."],
    applying: ["Applying patch…", "The requested code change is being applied."],
    checking: ["Running checks…", "Build or verification checks are running."],
    verifying: ["Verifying result…", "The result is being verified."],
    deploying: ["Deploying…", "Deployment has started."],
    complete: ["Ready", "The build step is complete."],
    error: ["Something went wrong", "The build step failed."],
  },
  link: {
    starting: ["Reading source…", "The link is being reviewed."],
    thinking: ["Reading source…", "The link is being reviewed."],
    complete: ["Ready", "The link request is complete."],
    error: ["Something went wrong", "The link request did not complete successfully."],
  },
  artifact: {
    starting: ["Preparing response…", "The requested content is being prepared."],
    rendering: ["Writing…", "The requested content is being prepared."],
    complete: ["Ready", "The content is ready."],
    error: ["Something went wrong", "The request did not complete successfully."],
  },
};

const INTERNAL_STATUS_PATTERNS = [
  /loading chat history/i,
  /server timestamp/i,
  /backend/i,
  /provider/i,
  /model\b/i,
  /request id/i,
  /route\b/i,
  /api[_ -]?key/i,
  /openai|anthropic|claude|gpt|fal\b|runway|kling|veo|elevenlabs/i,
  /cost[_ -]?usd|\busd\b|margin|latency|retry count/i,
  /stack trace|traceback|exception|sqlstate|postgres|supabase/i,
  /streams-ai-memory-provider-router|responses-live|provider-router/i,
];

function parseCreateActivityArgs(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === "object") return arg1;
  if (typeof arg1 === "string" || typeof arg2 === "string" || typeof arg3 === "string") {
    return { phase: arg1 || "starting", mode: arg2 || "chat", statusText: arg3 };
  }
  return {};
}

function statusStyle(phase) {
  if (phase === "error" || phase === "failed") return "error";
  if (phase === "complete") return "success";
  if (phase === "waiting" || phase === "blocked") return "warning";
  return "subtle";
}

export function isPublicStreamsActivity(activity = {}) {
  const text = normalizeStatusText(activity?.statusText);
  if (!text || !canShowStreamsStatus(text)) return false;
  if (INTERNAL_STATUS_PATTERNS.some((pattern) => pattern.test(text))) return false;
  if (String(activity?.source || "").toLowerCase().includes("history")) return false;
  return activity?.visible !== false;
}

function publicActivity(activity) {
  return {
    id: activity.id,
    taskId: activity.taskId,
    turnId: activity.turnId,
    messageId: activity.messageId,
    jobId: activity.jobId,
    mode: activity.mode,
    phase: activity.phase,
    title: activity.title,
    statusText: activity.statusText,
    detail: activity.detail,
    nextStep: activity.nextStep,
    completedStep: activity.completedStep,
    approvalRequired: activity.approvalRequired,
    proofRequired: activity.proofRequired,
    visible: activity.visible,
    style: activity.style,
    createdAt: activity.createdAt,
  };
}

function publishActivity(activity) {
  if (typeof window === "undefined" || !isPublicStreamsActivity(activity)) return;
  window.dispatchEvent(new CustomEvent("streams:chat-activity", { detail: publicActivity(activity) }));
}

export function createActivity(arg1 = {}, arg2, arg3) {
  const input = parseCreateActivityArgs(arg1, arg2, arg3);
  const mode = input.mode || "chat";
  const phase = input.phase || "starting";
  const safeMode = ACTIVITY_LABELS[mode] ? mode : "chat";
  const group = ACTIVITY_LABELS[safeMode];
  const [fallbackTitle, subtitle] = group[phase] || group.starting;
  const requested = normalizeStatusText(input.statusText || fallbackTitle);
  const statusText = canShowStreamsStatus(requested) && !INTERNAL_STATUS_PATTERNS.some((pattern) => pattern.test(requested)) ? requested : fallbackTitle;
  const visible = canShowStreamsStatus(statusText) && !INTERNAL_STATUS_PATTERNS.some((pattern) => pattern.test(statusText));

  const activity = {
    id: input.id || `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    taskId: input.taskId || null,
    turnId: input.turnId || null,
    messageId: input.messageId || null,
    jobId: input.jobId || null,
    mode: safeMode,
    source: input.source || safeMode,
    phase,
    title: statusText,
    subtitle,
    statusText,
    detail: input.detail || "",
    nextStep: input.nextStep || "",
    completedStep: input.completedStep || "",
    approvalRequired: Boolean(input.approvalRequired),
    proofRequired: Boolean(input.proofRequired),
    backendProof: input.backendProof || null,
    visible,
    style: input.style || statusStyle(phase),
    createdAt: input.createdAt || new Date().toISOString(),
  };

  publishActivity(activity);
  return activity;
}

export function isGenerationActivity(activity) {
  return activity?.mode === "image" || activity?.mode === "video";
}
