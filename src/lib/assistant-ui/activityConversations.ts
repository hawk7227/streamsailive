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

const sharedEncouragement = {
  design: [
    "I’m keeping the look clean so it feels polished, not cluttered",
    "I’m shaping the visual direction around what you’re asking for",
    "I’m making sure this has the right feel before I hand it back",
  ],
  fix: [
    "I’m being careful here so the fix doesn’t create a new problem",
    "I’m narrowing this down and keeping the change clean",
    "I’m making sure the answer solves the issue, not just explains it",
  ],
  fast: [
    "I’m moving quickly, but still keeping this accurate",
    "I’m keeping this tight so you get the useful part fast",
    "I’m focusing on the strongest answer first",
  ],
  build: [
    "I’m keeping this aligned with your setup so it can be integrated cleanly",
    "I’m making sure this fits the way your system is supposed to work",
    "I’m keeping the structure clean so your dev can wire it in without guessing",
  ],
};

export const conversationActivities: ConversationActivity[] = [
  {
    id: "chat-thinking-calm-01",
    phase: "chat_thinking",
    layout: "chat",
    tone: "calm",
    intensity: 1,
    avoidRepeatGroup: "chat_thinking",
    lines: [
      "I see what you’re aiming for — let me shape this the right way",
      "Give me a second, I’m making sure this comes back clear",
      "I’m connecting the pieces so the answer actually fits what you asked",
      "I’m keeping this focused so it doesn’t turn into filler",
    ],
    followups: [
      "This is a good direction — I’m tightening it now",
      "I’m making sure the next response is useful, not generic",
      "I’m staying with your exact request and building from there",
    ],
    longWaitLines: [
      "Still with you — I’m making sure this is right before I send it",
      "I’m taking the extra second so the answer lands cleanly",
    ],
  },
  {
    id: "chat-thinking-focused-02",
    phase: "chat_thinking",
    layout: "chat",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "chat_thinking",
    lines: [
      "This needs a clean answer — I’m working through it carefully",
      "I’m sorting the important parts from the noise",
      "I’m making sure I answer the thing you actually care about",
      "I’m checking the direction before I commit to the response",
    ],
    followups: [
      "I’m not rushing this — the structure matters here",
      "I’m pulling this into a stronger, cleaner answer",
      "I’m keeping the answer practical so you can use it right away",
    ],
    longWaitLines: [
      "Still working through it — I want this to be solid",
      "Almost there — I’m cleaning up the last part now",
    ],
  },
  {
    id: "chat-thinking-confident-03",
    phase: "chat_thinking",
    layout: "chat",
    tone: "confident",
    intensity: 2,
    avoidRepeatGroup: "chat_thinking",
    lines: [
      "Got it — I know the direction now",
      "I’m turning this into something clear and usable",
      "I’m making sure the response matches the level you’re expecting",
      "I’m keeping this sharp and direct",
    ],
    followups: [
      "This is coming together cleanly",
      "I’m keeping the useful parts front and center",
      "I’m making sure this doesn’t drift away from your goal",
    ],
    longWaitLines: [
      "Still on it — I’m keeping the answer tight",
      "One more pass so this lands right",
    ],
  },

  {
    id: "build-starting-01",
    phase: "build_starting",
    layout: "build",
    tone: "confident",
    intensity: 2,
    avoidRepeatGroup: "build_starting",
    contextTags: ["build"],
    lines: [
      "Got it — I’m setting this up so your dev has a clean path",
      "I’m starting with the structure so this doesn’t feel patched together",
      "I’m keeping the pieces organized before the actual work starts",
      "I’m making sure the handoff is clear enough to build from",
    ],
    followups: sharedEncouragement.build,
    longWaitLines: [
      "Still setting the foundation — this part prevents confusion later",
      "I’m keeping the plan clean so integration is easier",
    ],
  },
  {
    id: "build-planning-01",
    phase: "build_planning",
    layout: "build",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "build_planning",
    contextTags: ["build"],
    lines: [
      "I’m mapping this out so the build has a real flow",
      "I’m checking how each piece should connect before writing it",
      "I’m making sure this fits the system instead of fighting it",
      "I’m keeping the plan practical so it can actually be used",
    ],
    followups: sharedEncouragement.build,
    longWaitLines: [
      "Still working through the structure — I’m keeping it clean",
      "This is the part where a better plan saves time later",
    ],
  },
  {
    id: "build-writing-01",
    phase: "build_writing",
    layout: "build",
    tone: "confident",
    intensity: 2,
    avoidRepeatGroup: "build_writing",
    contextTags: ["build"],
    lines: [
      "I’m putting this together the right way — no lazy shortcuts",
      "I’m keeping the file clean so it can be dropped in and reviewed",
      "I’m making sure the parts line up instead of leaving your dev to guess",
      "I’m building this with enough depth so it doesn’t feel thin",
    ],
    followups: [
      "This is coming together — I’m tightening the details now",
      "I’m keeping the naming clear so the integration is obvious",
      "I’m making sure this feels production-shaped, not like a quick note",
    ],
    longWaitLines: [
      "Still working — I’m keeping this complete instead of half-built",
      "I’m finishing the stronger version, not the rushed version",
    ],
  },
  {
    id: "build-reviewing-01",
    phase: "build_reviewing",
    layout: "build",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "build_reviewing",
    contextTags: ["build"],
    lines: [
      "I’m checking this before handing it over",
      "I’m looking for anything that would make integration confusing",
      "I’m tightening the wording and structure so it’s easier to use",
      "I’m making sure this doesn’t leave obvious gaps",
    ],
    followups: [
      "Almost there — I’m cleaning up the last pieces",
      "I’m making sure the final version is easy to follow",
      "I’m keeping the output direct so your dev can move fast",
    ],
    longWaitLines: [
      "Still reviewing — I’d rather catch the issue here than later",
      "Final pass now — keeping it clean",
    ],
  },

  {
    id: "image-submitting-01",
    phase: "image_submitting",
    layout: "image",
    tone: "excited",
    intensity: 3,
    avoidRepeatGroup: "image_submitting",
    contextTags: ["design"],
    lines: [
      "Got it — I’m sending your visual direction through now",
      "I’m keeping your style in focus so this doesn’t come back random",
      "I’m setting this up to match the look you asked for",
      "I’m making sure the visual request is clear before it starts",
    ],
    followups: sharedEncouragement.design,
    longWaitLines: [
      "Still with it — I’m keeping the image direction steady",
      "This part is starting the visual pass",
    ],
  },
  {
    id: "image-queued-01",
    phase: "image_queued",
    layout: "image",
    tone: "reassuring",
    intensity: 2,
    avoidRepeatGroup: "image_queued",
    contextTags: ["design"],
    lines: [
      "Your image is lined up — waiting for its turn now",
      "It’s in place and ready to start",
      "I’m keeping the request active while it waits",
      "Nothing is lost — it’s just waiting to begin",
    ],
    followups: [
      "I’ll keep this moving as soon as it opens up",
      "You’ll see the visual as soon as it’s ready",
      "Still here — keeping the request alive",
    ],
    longWaitLines: [
      "Still waiting — I’ll keep you posted instead of going silent",
      "This is still queued, and I’m watching for the next change",
    ],
  },
  {
    id: "image-generating-01",
    phase: "image_generating",
    layout: "image",
    tone: "excited",
    intensity: 3,
    avoidRepeatGroup: "image_generating",
    contextTags: ["design"],
    lines: [
      "This is starting to take shape now",
      "I’m pushing it toward the look you described",
      "I’m keeping the details clean so it doesn’t feel generic",
      "This should feel more polished than a basic output",
    ],
    followups: [
      "I’m dialing in the visual feel now",
      "The stronger version is worth the extra moment",
      "I’m keeping the composition clean and intentional",
      "This is the part where the image starts to feel real",
    ],
    longWaitLines: [
      "Still working — I’m letting the visual finish properly",
      "It’s still moving — I’ll switch over as soon as the image is ready",
    ],
  },
  {
    id: "image-finalizing-01",
    phase: "image_finalizing",
    layout: "image",
    tone: "confident",
    intensity: 2,
    avoidRepeatGroup: "image_finalizing",
    contextTags: ["design"],
    lines: [
      "Almost there — I’m getting the image ready to show you",
      "I’m wrapping it up so it appears cleanly",
      "The visual is nearly ready",
      "I’m making sure it lands in the right place",
    ],
    followups: [
      "Just a moment — preparing the preview",
      "This should show up shortly",
      "Final touch before you see it",
    ],
    longWaitLines: [
      "Still finalizing — I’m waiting for the output to come through",
      "Almost there — I’ll show it as soon as it’s available",
    ],
  },

  {
    id: "video-submitting-01",
    phase: "video_submitting",
    layout: "video",
    tone: "excited",
    intensity: 3,
    avoidRepeatGroup: "video_submitting",
    lines: [
      "Got it — I’m starting the video request now",
      "I’m keeping the motion and feel aligned with what you asked for",
      "I’m setting this up so the final result doesn’t feel flat",
      "I’m preparing the video direction before it starts moving",
    ],
    followups: [
      "The goal is smooth, not rushed",
      "I’m keeping the scene direction clear",
      "This needs to feel natural when it plays",
    ],
    longWaitLines: [
      "Still preparing it — I’ll keep you updated as it moves",
      "This is still active, and I’m watching for the next step",
    ],
  },
  {
    id: "video-queued-01",
    phase: "video_queued",
    layout: "video",
    tone: "reassuring",
    intensity: 2,
    avoidRepeatGroup: "video_queued",
    lines: [
      "Your video is lined up and waiting to begin",
      "It’s in the queue — I’ll keep this alive while it waits",
      "Nothing stopped — it’s just waiting for its turn",
      "I’m holding the request steady until it starts",
    ],
    followups: [
      "I’ll update you as soon as it begins",
      "Still here — no dead screen while it waits",
      "This can take a little longer, but it’s still moving",
    ],
    longWaitLines: [
      "Still queued — I’ll keep you posted instead of going quiet",
      "It’s still waiting, and I’m watching for the next update",
    ],
  },
  {
    id: "video-generating-01",
    phase: "video_generating",
    layout: "video",
    tone: "excited",
    intensity: 3,
    avoidRepeatGroup: "video_generating",
    lines: [
      "This is moving now — I’m waiting for the video to take shape",
      "I’m keeping an eye on the flow so the result feels smooth",
      "The scene is coming together frame by frame",
      "I’m watching for the moment it’s ready to preview",
    ],
    followups: [
      "This part can take a bit, but it’s still working",
      "I’m keeping the motion direction in focus",
      "The goal is a video that feels polished, not stiff",
      "Still moving — I’ll bring it forward as soon as it’s ready",
    ],
    longWaitLines: [
      "Still working — video takes longer, but I’m not letting the UI go silent",
      "It’s still active — I’ll show the player as soon as it finishes",
    ],
  },
  {
    id: "video-processing-01",
    phase: "video_processing",
    layout: "video",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "video_processing",
    lines: [
      "The video is being prepared so it plays back cleanly",
      "I’m waiting for the final version to be ready",
      "This is the cleanup pass before you can view it",
      "I’m getting the video into a usable preview state",
    ],
    followups: [
      "Almost there — this is the final stretch",
      "I’m keeping the playback result in focus",
      "The preview should be ready shortly",
    ],
    longWaitLines: [
      "Still preparing playback — I’ll switch over when it’s ready",
      "It’s taking a little longer, but the request is still active",
    ],
  },
  {
    id: "video-finalizing-01",
    phase: "video_finalizing",
    layout: "video",
    tone: "confident",
    intensity: 2,
    avoidRepeatGroup: "video_finalizing",
    lines: [
      "Almost there — I’m getting the video ready for you",
      "I’m preparing the player now",
      "The video is nearly ready to view",
      "Just a moment — getting the final preview in place",
    ],
    followups: [
      "This should appear shortly",
      "Final step before playback",
      "I’m bringing the result forward now",
    ],
    longWaitLines: [
      "Still finalizing — I’ll show it as soon as it’s ready",
      "Almost there — the player is the next step",
    ],
  },

  {
    id: "tool-running-01",
    phase: "tool_running",
    layout: "tool",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "tool_running",
    lines: [
      "I’m using the right helper for this now",
      "I’m checking the outside piece so the answer is grounded",
      "I’m waiting on the result so I don’t guess",
      "I’m pulling in what’s needed before I answer",
    ],
    followups: [
      "Still checking — I’ll keep this moving",
      "I’m making sure the result is useful before I continue",
      "This helps avoid giving you a weak answer",
    ],
    longWaitLines: [
      "Still waiting on that piece — I’ll continue as soon as it returns",
      "This is taking a moment, but it’s still active",
    ],
  },
  {
    id: "file-reading-01",
    phase: "file_reading",
    layout: "tool",
    tone: "focused",
    intensity: 2,
    avoidRepeatGroup: "file_reading",
    lines: [
      "I’m reading through the file now",
      "I’m looking for the parts that matter to your request",
      "I’m keeping the answer tied to what’s actually in the file",
      "I’m checking the details before I summarize anything",
    ],
    followups: [
      "I’m not going to guess — I’m using the file as the source",
      "I’m pulling the useful parts together",
      "I’m keeping this grounded in the document",
    ],
    longWaitLines: [
      "Still reading — I’m making sure I don’t miss the important part",
      "This file needs a careful pass, and I’m still on it",
    ],
  },
  {
    id: "uploading-01",
    phase: "uploading",
    layout: "tool",
    tone: "reassuring",
    intensity: 1,
    avoidRepeatGroup: "uploading",
    lines: [
      "I’m getting the upload into place",
      "I’m making sure it lands cleanly",
      "I’m keeping this moving while the file finishes",
      "The upload is still active",
    ],
    followups: [
      "Almost there — waiting for it to finish",
      "I’ll continue as soon as the upload is ready",
      "Still moving — nothing needs to be resent yet",
    ],
    longWaitLines: [
      "Still uploading — I’ll keep watching it",
      "This is taking a little longer, but it’s still active",
    ],
  },
  {
    id: "saving-01",
    phase: "saving",
    layout: "tool",
    tone: "confident",
    intensity: 1,
    avoidRepeatGroup: "saving",
    lines: [
      "I’m saving this so it doesn’t get lost",
      "I’m making sure the result is stored cleanly",
      "I’m putting this in place now",
      "I’m keeping the output preserved before moving on",
    ],
    followups: [
      "Almost saved",
      "I’m checking that it lands where it should",
      "This should be ready in a moment",
    ],
    longWaitLines: [
      "Still saving — I’ll update you when it finishes",
      "This is taking a moment, but I’m keeping the state active",
    ],
  },
  {
    id: "retrying-01",
    phase: "retrying",
    layout: "tool",
    tone: "reassuring",
    intensity: 2,
    avoidRepeatGroup: "retrying",
    lines: [
      "That didn’t go through cleanly, so I’m trying again",
      "I’m giving it another pass instead of stopping too early",
      "I’m keeping the request alive and checking it again",
      "I’m trying a cleaner path now",
    ],
    followups: [
      "Still with you — I’m not dropping the request",
      "I’m watching for the next result",
      "I’ll only move forward when there’s something real to show",
    ],
    longWaitLines: [
      "Still retrying — I’ll tell you if it can’t recover",
      "This is taking longer, but I’m still actively checking it",
    ],
  },
  {
    id: "recovering-01",
    phase: "recovering",
    layout: "tool",
    tone: "reassuring",
    intensity: 2,
    avoidRepeatGroup: "recovering",
    lines: [
      "Something got interrupted — I’m getting us back on track",
      "I’m checking what finished and what still needs attention",
      "I’m recovering the flow instead of starting over blindly",
      "I’m keeping the request intact while I sort this out",
    ],
    followups: [
      "Still working through the recovery",
      "I’m looking for the safest next step",
      "I’ll keep this clear and tell you what happened if it can’t continue",
    ],
    longWaitLines: [
      "Still recovering — I’m making sure we don’t lose the work",
      "This needs a careful handoff back into the flow",
    ],
  },
  {
    id: "done-01",
    phase: "done",
    layout: "quiet",
    tone: "confident",
    intensity: 1,
    avoidRepeatGroup: "done",
    lines: [
      "Done — I’ve got it ready for you",
      "All set — here’s the result",
      "That’s ready now",
      "Finished — take a look",
    ],
  },
  {
    id: "error-01",
    phase: "error",
    layout: "quiet",
    tone: "reassuring",
    intensity: 1,
    avoidRepeatGroup: "error",
    lines: [
      "Something didn’t complete cleanly",
      "I hit an issue before this could finish",
      "That didn’t land the way it should",
      "I couldn’t complete that step yet",
    ],
    followups: [
      "I’ll keep the explanation clear so you know what failed",
      "I won’t pretend it worked — I’ll show what happened",
      "We can fix the failing part without guessing",
    ],
  },
];

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function detectTags(userText?: string): string[] {
  if (!userText) return [];
  const text = normalizeText(userText);
  const tags: string[] = [];

  if (/(design|layout|visual|image|photo|style|color|frontend|ui|look|mockup|preview)/.test(text)) tags.push("design");
  if (/(fix|broken|error|issue|bug|wrong|not working|failed)/.test(text)) tags.push("fix");
  if (/(fast|quick|hurry|urgent|asap|speed)/.test(text)) tags.push("fast");
  if (/(build|code|file|repo|dev|integrate|component|production)/.test(text)) tags.push("build");

  return tags;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function getContextLines(userText?: string): string[] {
  const tags = detectTags(userText);
  return unique(tags.flatMap((tag) => sharedEncouragement[tag as keyof typeof sharedEncouragement] ?? []));
}

export function getActivitiesForPhase(phase: ActivityPhase): ConversationActivity[] {
  return conversationActivities.filter((item) => item.phase === phase);
}

export function pickConversationActivity(context: ActivityContext): ConversationActivity | null {
  const phase = context.phase ?? "chat_thinking";
  const candidates = getActivitiesForPhase(phase);
  if (!candidates.length) return null;

  const tags = detectTags(context.userText);
  const scored = candidates
    .map((item) => {
      const tagScore = item.contextTags?.some((tag) => tags.includes(tag)) ? 4 : 0;
      const modeScore = context.mode && item.layout === context.mode ? 2 : 0;
      const repeatPenalty = context.recentLineIds?.includes(item.id) ? -8 : 0;
      return { item, score: tagScore + modeScore + repeatPenalty };
    })
    .sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const top = scored.filter((entry) => entry.score === topScore);
  const index = Math.floor(Math.random() * top.length);
  return top[index]?.item ?? candidates[0] ?? null;
}

export function buildActivityLinePool(activity: ConversationActivity, context: ActivityContext = {}): string[] {
  const elapsedMs = context.elapsedMs ?? 0;
  const contextLines = getContextLines(context.userText);
  const base = [
    ...activity.lines,
    ...(activity.followups ?? []),
    ...contextLines,
    ...(elapsedMs > 2200 ? activity.longWaitLines ?? [] : []),
  ];

  return unique(base);
}

export function pickActivityLines(activity: ConversationActivity, context: ActivityContext = {}, count = 3): string[] {
  const pool = buildActivityLinePool(activity, context);
  if (!pool.length) return [];

  const recent = new Set(context.recentLineIds ?? []);
  const fresh = pool.filter((line) => !recent.has(line));
  const source = fresh.length >= count ? fresh : pool;

  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
