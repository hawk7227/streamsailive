const IMAGES_KEY = "streams.generated.images.v1";
const VIDEOS_KEY = "streams.generated.videos.v1";
const LIBRARY_KEY = "streams.library.files.v1";

function safeRead(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function upsertById(list, item) {
  const next = [item, ...list.filter((entry) => entry.id !== item.id)];
  return next.slice(0, 200);
}

export function listGeneratedImages() {
  return safeRead(IMAGES_KEY, []);
}

export function addGeneratedImage(image) {
  const next = upsertById(listGeneratedImages(), image);
  safeWrite(IMAGES_KEY, next);
  return next;
}

export function updateGeneratedImage(id, patch) {
  const next = listGeneratedImages().map((item) =>
    item.id === id ? { ...item, ...patch } : item
  );
  safeWrite(IMAGES_KEY, next);
  return next;
}

export function listGeneratedVideos() {
  return safeRead(VIDEOS_KEY, []);
}

export function addGeneratedVideo(video) {
  const next = upsertById(listGeneratedVideos(), video);
  safeWrite(VIDEOS_KEY, next);
  return next;
}

export function updateGeneratedVideo(id, patch) {
  const next = listGeneratedVideos().map((item) =>
    item.id === id ? { ...item, ...patch } : item
  );
  safeWrite(VIDEOS_KEY, next);
  return next;
}

export function listLibraryFiles() {
  return safeRead(LIBRARY_KEY, []);
}

export function upsertLibraryFile(file) {
  const next = upsertById(listLibraryFiles(), file);
  safeWrite(LIBRARY_KEY, next);
  return next;
}

export function buildShareChatPayload(session) {
  const title = session?.title || "Streams chat";
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  const text = messages
    .map((message) => {
      const role = message.role === "user" ? "User" : "Assistant";
      const body =
        message.content ||
        message.generatedImage?.url ||
        message.generatedVideoUrl ||
        "";
      return `${role}: ${body}`;
    })
    .join("\n\n")
    .trim();

  return {
    title,
    text,
  };
}
