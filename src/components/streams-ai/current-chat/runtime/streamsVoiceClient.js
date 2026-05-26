const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_STREAMS_API_BASE_URL || "";

function apiUrl(path) {
  return `${DEFAULT_BASE}${path}`;
}

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || fallbackMessage || `Request failed: ${response.status}`);
  }
  return data;
}

export function isVoiceIntent(message = "") {
  const text = String(message || "").toLowerCase();
  return /\b(voice|tts|text to speech|speak|narrat|audio|dub|caption)\b/.test(text);
}

export async function generateStreamsVoice({
  text,
  prompt,
  voiceId,
  voiceName,
  languageCode,
  provider = "elevenlabs",
  userId,
  workspaceId,
  sessionId,
  signal,
  onStatus,
} = {}) {
  const cleanText = String(text || prompt || "").trim();
  if (!cleanText) throw new Error("Voice text is required.");

  onStatus?.("Submitting voice generation…");

  const response = await fetch(apiUrl("/api/streams/voice/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: cleanText,
      text: cleanText,
      voiceId,
      voiceName,
      language_code: languageCode,
      provider,
      userId,
      workspaceId,
      sessionId,
    }),
    signal,
  });

  const data = await readJson(response, "Voice generation request failed.");

  return {
    generationId: data.generationId || data.id || null,
    responseUrl: data.responseUrl || data.fal_request_id || null,
    artifactUrl: data.artifactUrl || data.outputUrl || data.audioUrl || null,
    mimeType: data.mimeType || "audio/mpeg",
    raw: data,
  };
}
