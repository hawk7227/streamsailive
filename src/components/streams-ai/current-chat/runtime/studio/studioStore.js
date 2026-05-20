const LIBRARY_KEY = "streams.studio.library.v2";
const PROJECT_KEY = "streams.studio.projects.v2";

export function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function inferKind(file) {
  const type = file?.type || "";
  const name = file?.name || "";

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.includes("spreadsheet") || name.match(/\.(csv|xls|xlsx)$/i)) return "spreadsheet";
  if (type.includes("presentation") || name.match(/\.(ppt|pptx)$/i)) return "presentation";
  if (type.includes("word") || name.match(/\.(doc|docx)$/i)) return "document";
  if (name.match(/\.(js|jsx|ts|tsx|json|css|html|md|txt|py|zip)$/i)) return "file";
  return "file";
}

export function createLocalAsset(file, toolId = "studio") {
  const previewUrl = URL.createObjectURL(file);
  return {
    id: makeId("asset"),
    toolId,
    kind: inferKind(file),
    source: "uploaded",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size || 0,
    previewUrl,
    downloadUrl: previewUrl,
    createdAt: new Date().toISOString(),
  };
}

export function listLibrary() {
  const items = readJson(LIBRARY_KEY, []);
  return Array.isArray(items)
    ? items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    : [];
}

export function saveLibraryItem(item) {
  if (!item?.id) return listLibrary();

  const clean = {
    ...item,
    file: undefined,
    savedAt: new Date().toISOString(),
  };

  const next = [clean, ...listLibrary().filter((entry) => entry.id !== clean.id)].slice(0, 500);
  writeJson(LIBRARY_KEY, next);
  window.dispatchEvent(new CustomEvent("streams-library-updated"));
  return next;
}

export function listProjects() {
  const items = readJson(PROJECT_KEY, []);
  return Array.isArray(items)
    ? items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    : [];
}

export function saveProject(project) {
  if (!project?.id) return listProjects();

  const clean = {
    ...project,
    updatedAt: new Date().toISOString(),
    createdAt: project.createdAt || new Date().toISOString(),
  };

  const next = [clean, ...listProjects().filter((entry) => entry.id !== clean.id)].slice(0, 200);
  writeJson(PROJECT_KEY, next);
  window.dispatchEvent(new CustomEvent("streams-projects-updated"));
  return clean;
}

export function getProject(id) {
  return listProjects().find((project) => project.id === id) || null;
}

export function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
