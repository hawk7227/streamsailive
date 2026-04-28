export type ActivityPhase =
  | "idle"
  | "chat_thinking"
  | "chat_streaming"
  | "build_starting"
  | "build_planning"
  | "build_writing"
  | "build_reviewing"
  | "image_submitting"
  | "image_queued"
  | "image_generating"
  | "image_finalizing"
  | "video_submitting"
  | "video_queued"
  | "video_generating"
  | "video_processing"
  | "video_finalizing"
  | "tool_running"
  | "file_reading"
  | "uploading"
  | "saving"
  | "retrying"
  | "recovering"
  | "done"
  | "error";

export type ActivityTone = "calm" | "confident" | "focused" | "excited" | "reassuring";
export type ActivityLayout = "chat" | "build" | "image" | "video" | "tool" | "quiet";

export type ConversationActivity = {
  id: string;
  phase: ActivityPhase;
  layout: ActivityLayout;
  tone: ActivityTone;
  intensity: 1 | 2 | 3;
  avoidRepeatGroup: string;
  minMs?: number;
  lines: string[];
  followups?: string[];
  longWaitLines?: string[];
  contextTags?: string[];
};

export type ActivityContext = {
  userText?: string;
  mode?: "chat" | "build" | "image" | "video" | "tool";
  phase?: ActivityPhase;
  elapsedMs?: number;
  recentLineIds?: string[];
};

function layoutForPhase(phase: ActivityPhase): ActivityLayout {
  if (phase.startsWith("image_")) return "image";
  if (phase.startsWith("video_")) return "video";
  if (phase.startsWith("build_")) return "build";
  if (phase === "tool_running" || phase === "file_reading" || phase === "uploading" || phase === "saving") return "tool";
  return "chat";
}

function lineForPhase(phase: ActivityPhase): string {
  switch (phase) {
    case "chat_streaming":
      return "Responding…";
    case "build_starting":
    case "build_planning":
      return "Preparing the build…";
    case "build_writing":
      return "Building your code…";
    case "build_reviewing":
      return "Reviewing your code…";
    case "image_submitting":
    case "image_queued":
    case "image_generating":
      return "Generating your image…";
    case "image_finalizing":
      return "Finalizing your image…";
    case "video_submitting":
    case "video_queued":
    case "video_generating":
    case "video_processing":
      return "Generating your video…";
    case "video_finalizing":
      return "Finalizing your video…";
    case "file_reading":
      return "Reading your file…";
    case "uploading":
      return "Uploading…";
    case "saving":
      return "Saving…";
    case "tool_running":
      return "Running the requested action…";
    case "retrying":
      return "Retrying…";
    case "recovering":
      return "Recovering…";
    case "error":
      return "Something went wrong.";
    case "done":
      return "Done";
    case "idle":
      return "";
    case "chat_thinking":
    default:
      return "Thinking…";
  }
}

export const conversationActivities: ConversationActivity[] = [
  "chat_thinking",
  "chat_streaming",
  "build_starting",
  "build_planning",
  "build_writing",
  "build_reviewing",
  "image_submitting",
  "image_queued",
  "image_generating",
  "image_finalizing",
  "video_submitting",
  "video_queued",
  "video_generating",
  "video_processing",
  "video_finalizing",
  "tool_running",
  "file_reading",
  "uploading",
  "saving",
  "retrying",
  "recovering",
  "done",
  "error",
].map((phase) => ({
  id: phase,
  phase: phase as ActivityPhase,
  layout: layoutForPhase(phase as ActivityPhase),
  tone: "calm" as ActivityTone,
  intensity: 1 as const,
  avoidRepeatGroup: phase,
  lines: [lineForPhase(phase as ActivityPhase)].filter(Boolean),
}));

export function getContextLines(): string[] {
  return [];
}

export function getActivitiesForPhase(phase: ActivityPhase): ConversationActivity[] {
  return conversationActivities.filter((item) => item.phase === phase);
}

export function pickConversationActivity(context: ActivityContext): ConversationActivity | null {
  const phase = context.phase ?? "chat_thinking";
  return getActivitiesForPhase(phase)[0] ?? null;
}

export function buildActivityLinePool(activity: ConversationActivity): string[] {
  return activity.lines;
}

export function pickActivityLines(activity: ConversationActivity, _context: ActivityContext = {}, count = 1): string[] {
  return activity.lines.slice(0, count);
}
