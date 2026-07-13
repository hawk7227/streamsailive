import { canShowStreamsStatus, normalizeStatusText } from "./streamsStatusRegistry";

const LABELS = {
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
    checking: ["Checking image request…", "The request is being validated."],
    starting: ["Starting image generation…", "The image request is starting."],
    rendering: ["Generating image…", "Your image is being created."],
    polling: ["Receiving preview…", "Streams is waiting for the latest image output."],
    saving: ["Saving image…", "The completed image is being saved."],
    complete: ["Image ready", "Your generated image is ready."],
    error: ["Image failed", "The image request did not complete successfully."],
    cancelled: ["Request cancelled", "The image request was cancelled."],
  },
  video: {
    preparing: ["Preparing video request…", "The video request is being prepared."],
    starting: ["Starting video generation…", "The video request is starting."],
    rendering: ["Rendering video…", "Your video is being created."],
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
    applying: ["Applying patch…", "The requested change is being applied."],
    checking: ["Running checks…", "Verification checks are running."],
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

const INTERNAL = [
  /loading chat history/i,
  /server timestamp/i,
  /backend|provider|model\b|request id|provider route/i,
  /api[_ -]?key|openai|anthropic|claude|gpt|fal\b|runway|kling|veo|elevenlabs/i,
  /cost[_ -]?usd|\busd\b|margin|latency|retry count/i,
  /stack trace|traceback|exception|sqlstate|postgres|supabase/i,
  /streams-ai-memory-provider-router|responses-live|provider-router/i,
];

function args(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === "object") return arg1;
  return { phase: arg1 || "starting", mode: arg2 || "chat", statusText: arg3 };
}

function style(phase) {
  if (["error", "failed"].includes(phase)) return "error";
  if (phase === "complete") return "success";
  if (["waiting", "blocked"].includes(phase)) return "warning";
  return "subtle";
}

function isInternal(text = "", source = "") {
  return String(source).toLowerCase().includes("history") || INTERNAL.some((pattern) => pattern.test(String(text)));
}

export function isPublicStreamsActivity(activity = {}) {
  const text = normalizeStatusText(activity?.statusText);
  return Boolean(text && canShowStreamsStatus(text) && !isInternal(text, activity?.source) && activity?.visible !== false);
}

function publish(activity) {
  if (typeof window === "undefined" || !isPublicStreamsActivity(activity)) return;
  const { backendProof, source, subtitle, ...safe } = activity;
  window.dispatchEvent(new CustomEvent("streams:chat-activity", { detail: safe }));
}

export function createActivity(arg1 = {}, arg2, arg3) {
  const input = args(arg1, arg2, arg3);
  const mode = LABELS[input.mode] ? input.mode : "chat";
  const phase = input.phase || "starting";
  const [fallback, subtitle] = LABELS[mode][phase] || LABELS[mode].starting;
  const requested = normalizeStatusText(input.statusText || fallback);
  const internal = isInternal(requested, input.source);
  const statusText = internal ? requested : canShowStreamsStatus(requested) ? requested : fallback;
  const activity = {
    id: input.id || `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    taskId: input.taskId || null,
    turnId: input.turnId || null,
    messageId: input.messageId || null,
    jobId: input.jobId || null,
    mode,
    source: input.source || mode,
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
    visible: !internal && canShowStreamsStatus(statusText) && input.visible !== false,
    style: input.style || style(phase),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  publish(activity);
  return activity;
}

export function isGenerationActivity(activity) {
  return activity?.mode === "image" || activity?.mode === "video";
}
