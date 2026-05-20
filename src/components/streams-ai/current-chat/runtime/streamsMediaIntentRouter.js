const URL_RE = /(https?:\/\/[^\s]+)/i;
const YOUTUBE_RE = /(^|\.)((youtube\.com)|(youtu\.be))$/i;

function textOf(value) {
  return String(value || "").trim();
}

function attachmentKind(item = {}) {
  const kind = String(item.kind || "").toLowerCase();
  const mimeType = String(item.mimeType || item.type || "").toLowerCase();

  if (kind) return kind;
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

export function extractFirstUrl(message = "") {
  const match = textOf(message).match(URL_RE);
  return match ? match[0] : "";
}

export function isYouTubeUrl(url = "") {
  try {
    const parsed = new URL(url);
    return YOUTUBE_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function detectStreamsMediaIntent({ message = "", attachments = [] } = {}) {
  const raw = textOf(message);
  const text = raw.toLowerCase();
  const list = Array.isArray(attachments) ? attachments : [];
  const hasImage = list.some((item) => attachmentKind(item) === "image");
  const hasAttachment = list.length > 0;
  const url = extractFirstUrl(raw);

  if (url && isYouTubeUrl(url)) {
    return { mode: "youtube_ingestion", url, sourceType: "youtube" };
  }

  if (url) {
    return { mode: "url_ingestion", url, sourceType: "url" };
  }

  if (hasAttachment && !text) {
    return { mode: "file_upload", attachmentCount: list.length };
  }

  if (hasImage && /(micro analyze|micro analyse|analy[sz]e|inspect|read|look closely|what do you see)/i.test(text)) {
    return {
      mode: "image_analysis",
      detail: text.includes("micro") ? "original" : "auto",
      reasoning: text.includes("micro") ? "high" : "normal",
    };
  }

  if (hasImage && /(edit|change|restyle|remove|add|replace|make this image|based on this image)/i.test(text)) {
    return { mode: "image_to_image" };
  }

  if (hasImage && /(animate|turn.*video|make.*video|image to video|motion|move)/i.test(text)) {
    return { mode: "image_to_video" };
  }

  if (/(generate|create|make).*(image|picture|photo)|^(image|picture|photo)\b/i.test(text)) {
    return { mode: "text_to_image" };
  }

  if (/(generate|create|make).*(video|movie|clip)|text to video|video from scratch/i.test(text)) {
    return { mode: "text_to_video" };
  }

  if (/(voice|talk|audio conversation|speak)/i.test(text)) {
    return { mode: "audio_voice" };
  }

  return { mode: "unknown_chat" };
}
