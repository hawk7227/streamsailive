export const STREAMS_UPLOAD_LIMITS = Object.freeze({
  image: 50 * 1024 * 1024,
  video: 5 * 1024 * 1024 * 1024,
  audio: 500 * 1024 * 1024,
  document: 250 * 1024 * 1024,
  code: 25 * 1024 * 1024,
  archive: 1024 * 1024 * 1024,
  file: 100 * 1024 * 1024,
});

const EXTENSION_KIND = Object.freeze({
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  avif: "image",
  heic: "image",
  heif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  m4v: "video",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
  ogg: "audio",
  pdf: "document",
  doc: "document",
  docx: "document",
  txt: "document",
  md: "document",
  csv: "document",
  json: "code",
  html: "code",
  js: "code",
  jsx: "code",
  ts: "code",
  tsx: "code",
  css: "code",
  liquid: "code",
  yaml: "code",
  yml: "code",
  xml: "code",
  sql: "code",
  zip: "archive",
});

function extensionFromName(name = "") {
  const parts = String(name).toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function getUploadKind(file = {}) {
  const type = String(file.type || file.mimeType || "").toLowerCase();
  const ext = extensionFromName(file.name);

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "document";

  return EXTENSION_KIND[ext] || "file";
}

export function validateUploadFile(file, options = {}) {
  if (!file) return { ok: false, reason: "missing_file" };

  const kind = getUploadKind(file);
  const limits = { ...STREAMS_UPLOAD_LIMITS, ...(options.limits || {}) };
  const maxBytes = limits[kind] ?? limits.file;
  const size = Number(file.size || 0);

  if (size <= 0) {
    return { ok: false, kind, reason: "empty_file" };
  }

  if (size > maxBytes) {
    return { ok: false, kind, reason: "file_too_large", maxBytes };
  }

  if (kind === "file") {
    return {
      ok: false,
      kind,
      reason: "unsupported_for_analysis",
      message: "This file type can be stored, but it cannot be analyzed yet.",
    };
  }

  return { ok: true, kind, maxBytes };
}

export function validateUploadFiles(files, options = {}) {
  return Array.from(files || []).map((file) => ({
    file,
    ...validateUploadFile(file, options),
  }));
}
