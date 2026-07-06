import { canShowStreamsStatus, normalizeStatusText } from "./streamsStatusRegistry";

const ACTIVITY_LABELS = {
  chat: {
    starting: ["Writing…", "The live assistant is preparing a response."],
    streaming: ["Writing…", "The answer is streaming."],
    complete: ["Ready", "The response is ready."],
    error: ["Ready", "The request did not complete successfully."],
  },
  file: {
    starting: ["Reading attached file…", "The attachment is being prepared."],
    uploading: ["Reading attached file…", "The attachment is being uploaded."],
    reading: ["Reading attached file…", "The attachment is being read."],
    extracting: ["Text extracted", "Readable attachment text is available."],
    complete: ["Files ready", "The file is ready."],
    error: ["Upload failed", "The upload did not complete successfully."],
  },
  image: {
    starting: ["Generating image…", "I’m setting up your image request now."],
    rendering: ["Generating image…", "Your image is actively being created."],
    polling: ["Generating image…", "I’m preparing the finished image output."],
    complete: ["Image ready", "Your generated image is ready."],
    error: ["Image failed", "The image request did not complete successfully."],
  },
  video: {
    starting: ["Rendering video…", "I’m setting up your video request now."],
    rendering: ["Rendering video…", "Your video is actively being created."],
    polling: ["Rendering video…", "I’m preparing the finished video output."],
    frames: ["Sampling frames…", "Video frame sampling is active."],
    complete: ["Video ready", "Your generated video is ready."],
    error: ["Video failed", "The video request did not complete successfully."],
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
    received: ["Received app response", "A tool or app response was received."],
    complete: ["Search complete", "The web search is complete."],
    error: ["Search failed", "The web search did not complete successfully."],
  },
  build: {
    starting: ["Running checks…", "Build or verification checks are running."],
    checking: ["Running checks…", "Build or verification checks are running."],
    deploying: ["Deploying…", "Deployment has started."],
    complete: ["Ready", "The build step is complete."],
    error: ["Ready", "The build step failed."],
  },
  link: {
    starting: ["Writing…", "The link request is being handled."],
    thinking: ["Writing…", "The link request is being handled."],
    complete: ["Ready", "The link request is complete."],
    error: ["Ready", "The link request did not complete successfully."],
  },
  artifact: {
    starting: ["Writing…", "The artifact request is starting."],
    rendering: ["Writing…", "The artifact request is running."],
    complete: ["Ready", "The artifact is ready."],
    error: ["Ready", "The artifact request did not complete successfully."],
  },
};

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
  return "subtle";
}

export function createActivity(arg1 = {}, arg2, arg3) {
  const input = parseCreateActivityArgs(arg1, arg2, arg3);
  const mode = input.mode || "chat";
  const phase = input.phase || "starting";
  const safeMode = ACTIVITY_LABELS[mode] ? mode : "chat";
  const group = ACTIVITY_LABELS[safeMode];
  const [fallbackTitle, subtitle] = group[phase] || group.starting;
  const requested = normalizeStatusText(input.statusText || fallbackTitle);
  const statusText = canShowStreamsStatus(requested) ? requested : fallbackTitle;
  const visible = canShowStreamsStatus(statusText);

  return {
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    mode: safeMode,
    source: input.source || safeMode,
    phase,
    title: statusText,
    subtitle,
    statusText,
    detail: input.detail || "",
    backendProof: input.backendProof || null,
    visible,
    style: input.style || statusStyle(phase),
    createdAt: new Date().toISOString(),
  };
}

export function isGenerationActivity(activity) {
  return activity?.mode === "image" || activity?.mode === "video";
}
