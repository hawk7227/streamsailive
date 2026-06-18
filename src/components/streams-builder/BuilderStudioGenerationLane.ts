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

async function readJson(response: Response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON but received: ${text.slice(0, 140)}`); }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.;]+$/, "") || "";
}

function studioRequest(value: string) {
  const imageUrl = extractFirstUrl(value);
  return {
    path: imageUrl ? "/api/studio/modules/image-to-video" : "/api/studio/modules/text-to-video",
    label: imageUrl ? "Studio Image to Video" : "Studio Text to Video",
    payload: {
      prompt: value,
      imageUrl: imageUrl || undefined,
      durationSeconds: 5,
      duration: 5,
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

  sendAgentLog(`${request.label} submitting.`, "generation-submitting", activeDetail);
  onStatus(`${request.label}: submitting durable Studio job...`);

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
  onStatus(`${request.label}: job ${jobId} submitted. Polling for artifact...`);

  for (let attempt = 1; attempt <= 100; attempt += 1) {
    await sleep(3000);
    const statusResponse = await fetch(`/api/studio/jobs/${encodeURIComponent(jobId)}/status`, { cache: "no-store" });
    const statusJson = (await readJson(statusResponse)) as StudioStatusResult;
    if (!statusResponse.ok || statusJson.ok === false || statusJson.blocked) throw new Error(statusJson.error || `${request.label} status failed`);

    const state = statusJson.status || "provider_running";
    sendAgentLog(`${request.label} ${state} · poll ${attempt}/100`, "generation-running", activeDetail);
    onStatus(`${request.label}: ${state} · poll ${attempt}/100`);

    const artifactUrl = statusJson.artifactUrl || statusJson.asset?.public_url || "";
    if (state === "completed" && artifactUrl) {
      window.dispatchEvent(new CustomEvent("streams-builder:media-output", {
        detail: { id: statusJson.asset?.id || jobId, kind: "video", title: "Studio video output", prompt: value, url: artifactUrl, status: "Ready" },
      }));
      sendAgentLog(`${request.label} completed and routed to Agent 1 Media tab.`, "generation-completed", activeDetail);
      onStatus(`${request.label}: completed and routed to Agent 1 Media tab.`);
      return;
    }

    if (state === "failed" || state === "blocked") throw new Error(statusJson.job?.error_message || statusJson.error || `${request.label} ${state}`);
  }

  throw new Error(`${request.label} timed out waiting for completed video artifact.`);
}
