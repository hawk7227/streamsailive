type PulledFileDetail = { repo: string; branch: string; path: string; folder: string; sha: string; content: string; route: string };

type StudioCreateResult = {
  ok?: boolean;
  blocked?: boolean;
  error?: string;
  jobId?: string;
};

type StudioStatusResult = {
  ok?: boolean;
  blocked?: boolean;
  error?: string;
  status?: string;
  artifactUrl?: string;
  asset?: { id?: string; public_url?: string; mime_type?: string; asset_type?: string } | null;
  job?: { error_message?: string } | null;
};

const MAX_STUDIO_PROMPT_LENGTH = 2400;
const STUDIO_POLL_INTERVAL_SECONDS = 3;
const STUDIO_MAX_POLLS = 100;

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`); }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function countdownForAttempt(attempt: number) {
  const totalSeconds = STUDIO_MAX_POLLS * STUDIO_POLL_INTERVAL_SECONDS;
  const elapsedSeconds = attempt * STUDIO_POLL_INTERVAL_SECONDS;
  return formatCountdown(totalSeconds - elapsedSeconds);
}

function readLastActiveFile() {
  try {
    const raw = window.localStorage.getItem("streams-builder:active-file");
    return raw ? JSON.parse(raw) as Partial<PulledFileDetail> : null;
  } catch {
    return null;
  }
}

function sendAgentLog(prompt: string, intent: string, pulled?: PulledFileDetail) {
  window.dispatchEvent(new CustomEvent("streams-builder:agent-one-command", { detail: { prompt, intent, pulled } }));
}

function sendMediaProgress(detail: { id: string; title: string; prompt: string; status: string; url?: string }) {
  window.dispatchEvent(new CustomEvent("streams-builder:media-output", {
    detail: { kind: "video", ...detail },
  }));
}

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") || "";
}

function isStreamsPromo(value: string) {
  return /streams\s*ai|streamsai|build\. create\. operate|business operator|builder/i.test(value);
}

function compileStudioVideoPrompt(value: string) {
  if (!isStreamsPromo(value) && value.length <= MAX_STUDIO_PROMPT_LENGTH) return value.replace(/\s+/g, " ").trim();

  return [
    "Premium cinematic SaaS commercial for Streams AI, realistic high-end startup brand style.",
    "Show a confident modern male founder/operator in a sleek creative tech studio, speaking naturally to camera, polished but not cheesy.",
    "Intercut elegant product-style visuals: AI chat interface, Builder workstations, live preview, code editor, project dashboard, media generation cards, approval/proof flow, and automation systems.",
    "Camera language: smooth push-ins, soft parallax, shallow depth of field, realistic office lighting, clean reflections, premium glass and dark-mode tech environment.",
    "Mood: trustworthy, powerful, modern, focused, high quality, not stock footage, not generic corporate filler.",
    "Visual story: one person explains how Streams AI helps users build, create, automate, and launch from one intelligent system.",
    "Avoid: blurry face, distorted hands, cheap stock-video look, random logos, unreadable UI text, cartoon style, exaggerated acting, warped screens.",
    "Audio note for this visual pass: create footage that feels ready for later voiceover and music, but do not rely on generated speech or on-screen captions in this clip.",
  ].join(" ");
}

function trimStudioPrompt(value: string) {
  const normalized = compileStudioVideoPrompt(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_STUDIO_PROMPT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_STUDIO_PROMPT_LENGTH - 90)}\n\n[Prompt shortened by Builder to fit provider input limits.]`;
}

function studioRequest(value: string) {
  const imageUrl = extractFirstUrl(value);
  const prompt = trimStudioPrompt(value);
  return {
    path: imageUrl ? "/api/studio/modules/image-to-video" : "/api/studio/modules/text-to-video",
    label: imageUrl ? "Studio Image to Video" : "Studio Text to Video",
    prompt,
    payload: {
      prompt,
      imageUrl: imageUrl || undefined,
      durationSeconds: 10,
      duration: 10,
      aspectRatio: "16:9",
      quality: "pro",
      workspaceId: "streams-builder",
      userId: "agent-1",
    },
  };
}

export function isStudioVideoRequest(value: string) {
  return /(image\s*to\s*video|text\s*to\s*video|video)/i.test(value);
}

export async function runStudioVideoLane(value: string, onStatus: (message: string) => void) {
  const lastActive = readLastActiveFile();
  const activeDetail = lastActive?.path ? lastActive as PulledFileDetail : undefined;
  const request = studioRequest(value);
  const maxWait = formatCountdown(STUDIO_MAX_POLLS * STUDIO_POLL_INTERVAL_SECONDS);

  sendAgentLog(`${request.label} submitting compiled visual prompt.`, "generation-submitting", activeDetail);
  onStatus(`${request.label}: submitting compiled visual prompt...`);

  const createResponse = await fetch(request.path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request.payload),
    cache: "no-store",
  });
  const createJson = (await readJson(createResponse)) as StudioCreateResult;
  if (!createResponse.ok || createJson.ok === false || createJson.blocked) throw new Error(createJson.error || `${request.label} job create failed`);
  const jobId = createJson.jobId;
  if (!jobId) throw new Error(`${request.label} did not return a jobId.`);

  sendAgentLog(`${request.label} job submitted: ${jobId}`, "generation-queued", activeDetail);
  sendMediaProgress({ id: jobId, title: `${request.label} job`, prompt: request.prompt, status: `Real provider job submitted · compiled prompt · countdown ${maxWait} · job ${jobId}` });
  onStatus(`${request.label}: job ${jobId} submitted. Countdown ${maxWait}.`);

  for (let attempt = 1; attempt <= STUDIO_MAX_POLLS; attempt += 1) {
    await sleep(STUDIO_POLL_INTERVAL_SECONDS * 1000);
    const statusResponse = await fetch(`/api/studio/jobs/${encodeURIComponent(jobId)}/status`, { cache: "no-store" });
    const statusJson = (await readJson(statusResponse)) as StudioStatusResult;
    if (!statusResponse.ok || statusJson.ok === false || statusJson.blocked) throw new Error(statusJson.error || `${request.label} status failed`);

    const state = statusJson.status || "provider_running";
    const remaining = countdownForAttempt(attempt);
    const runningStatus = `Generating on provider · ${state} · countdown ${remaining} · poll ${attempt}/${STUDIO_MAX_POLLS} · job ${jobId}`;
    sendAgentLog(`${request.label} ${state} · ${remaining} remaining · poll ${attempt}/${STUDIO_MAX_POLLS}`, "generation-running", activeDetail);
    sendMediaProgress({ id: jobId, title: `${request.label} job`, prompt: request.prompt, status: runningStatus });
    onStatus(`${request.label}: ${state} · countdown ${remaining} · poll ${attempt}/${STUDIO_MAX_POLLS}`);

    const artifactUrl = statusJson.artifactUrl || statusJson.asset?.public_url || "";
    if (state === "completed" && artifactUrl) {
      sendMediaProgress({ id: jobId, title: "Studio video output", prompt: request.prompt, url: artifactUrl, status: `Ready · visual pass only · job ${jobId}` });
      sendAgentLog(`${request.label} completed and routed to Agent 1 Media tab.`, "generation-completed", activeDetail);
      onStatus(`${request.label}: completed and routed to Agent 1 Media tab.`);
      return;
    }

    if (state === "failed" || state === "blocked") throw new Error(statusJson.job?.error_message || statusJson.error || `${request.label} ${state}`);
  }

  throw new Error(`${request.label} timed out after countdown expired waiting for completed video artifact.`);
}
