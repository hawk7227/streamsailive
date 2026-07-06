import { canShowStreamsStatus, normalizeStatusText } from "./streamsStatusRegistry";

const ACTIVITY_LABELS = {
  chat: {
    starting: ["Writing…", "The live assistant is preparing a response."],
    streaming: ["Writing…", "The answer is streaming."],
    complete: ["Ready", "The response is ready."],
    error: ["Upload failed", "The request did not complete successfully."],
  },
  file: {
    starting: ["Reading attached file…", "The attachment is being prepared."],
    uploading: ["Reading attached file…", "The attachment is being uploaded."],
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
    complete: ["Video ready", "Your generated video is ready."],
    error: ["Video failed", "The video request did not complete successfully."],
  },
  tool: {
    starting: ["Searching the web…", "The web search is starting."],
    thinking: ["Searching the web…", "The web search is running."],
    complete: ["Search complete", "The web search is complete."],
    error: ["Search failed", "The web search did not complete successfully."],
  },
  link: {
    starting: ["Writing…", "The link request is being handled."],
    thinking: ["Writing…", "The link request is being handled."],
    complete: ["Ready", "The link request is complete."],
    error: ["Upload failed", "The link request did not complete successfully."],
  },
  artifact: {
    starting: ["Writing…", "The artifact request is starting."],
    rendering: ["Writing…", "The artifact request is running."],
    complete: ["Ready", "The artifact is ready."],
    error: ["Upload failed", "The artifact request did not complete successfully."],
  },
};

function parseCreateActivityArgs(arg1, arg2, arg3) {
  if (arg1 && typeof arg1 === "object") return arg1;
  if (typeof arg1 === "string" || typeof arg2 === "string" || typeof arg3 === "string") {
    return { phase: arg1 || "starting", mode: arg2 || "chat", statusText: arg3 };
  }
  return {};
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

  return {
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    mode: safeMode,
    phase,
    title: statusText,
    subtitle,
    statusText,
    visible: canShowStreamsStatus(statusText),
    createdAt: new Date().toISOString(),
  };
}

export function isGenerationActivity(activity) {
  return activity?.mode === "image" || activity?.mode === "video";
}
