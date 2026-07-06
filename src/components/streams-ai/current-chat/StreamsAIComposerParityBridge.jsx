"use client";

import { useEffect, useRef, useState } from "react";

const CHAT_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;
const PROJECT_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 8000;
const MAX_FILES_PER_CHAT = 20;
const SPREADSHEET_MAX_BYTES = 50 * 1024 * 1024;
const TEXT_TOKEN_LIMIT = 2_000_000;
const APPROX_CHARS_PER_TOKEN = 4;
const ROLLING_UPLOAD_MAX = 80;
const ROLLING_UPLOAD_WINDOW_MS = 3 * 60 * 60 * 1000;
const STORAGE_CAP_BYTES = 2 * 1024 * 1024 * 1024;
const PROJECT_KEY = "streams-ai.projects.v1";
const ROLLING_KEY = "streams-ai.uploads.rolling.v1";
const STORAGE_KEY = "streams-ai.uploads.storage.v1";
const ACTIVE_PROJECT_KEY = "streams-ai.active-project.v1";

const ACCEPTED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "csv", "txt", "html", "htm", "odt", "rtf", "epub", "json", "xls", "xlsx", "ppt", "pptx", "md",
  "jpg", "jpeg", "png", "gif", "webp"
]);

function nowIso() { return new Date().toISOString(); }
function createId(prefix = "id") { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function bytesLabel(bytes = 0) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}
function readJson(key, fallback) {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function fileExtension(file) {
  const name = String(file?.name || "").toLowerCase();
  return name.includes(".") ? name.split(".").pop() : "";
}
function isImage(file) { return String(file?.type || "").startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension(file)); }
function isSpreadsheet(file) { return /spreadsheet|excel|csv/i.test(file?.type || "") || ["csv", "xls", "xlsx"].includes(fileExtension(file)); }
function isTextLike(file) { return /text|json|csv|html|xml|markdown/i.test(file?.type || "") || ["txt", "md", "json", "html", "htm", "csv"].includes(fileExtension(file)); }
function isPdf(file) { return fileExtension(file) === "pdf" || file?.type === "application/pdf"; }
function currentSessionId() {
  try {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] === "streams-ai" && parts[1] ? parts[1] : "general";
  } catch { return "general"; }
}
function activeProjectId() {
  try { return window.localStorage.getItem(ACTIVE_PROJECT_KEY) || "general"; } catch { return "general"; }
}
function readProjects() {
  const data = readJson(PROJECT_KEY, []);
  return Array.isArray(data) ? data : [];
}
function writeProjects(projects) {
  writeJson(PROJECT_KEY, projects);
  window.dispatchEvent(new Event("streams:projects-changed"));
}
function ensureProject() {
  const projects = readProjects();
  const active = activeProjectId();
  let project = projects.find((item) => item.id === active);
  if (!project) {
    project = { id: active === "general" ? "project_general" : active, name: active === "general" ? "General project" : "Current project", instructions: "", files: [], chatIds: [], createdAt: nowIso(), updatedAt: nowIso() };
    writeProjects([project, ...projects]);
  }
  return project;
}
function updateProject(project) {
  const projects = readProjects();
  const next = [{ ...project, updatedAt: nowIso() }, ...projects.filter((item) => item.id !== project.id)];
  writeProjects(next);
}
function recentRollingUploads() {
  const cutoff = Date.now() - ROLLING_UPLOAD_WINDOW_MS;
  return readJson(ROLLING_KEY, []).filter((item) => item?.time > cutoff);
}
function recordRollingUploads(count) {
  const next = [...recentRollingUploads(), ...Array.from({ length: count }, () => ({ time: Date.now() }))];
  writeJson(ROLLING_KEY, next);
  return next;
}
function storageUsedBytes() {
  return Number(readJson(STORAGE_KEY, { used: 0 })?.used || 0);
}
function addStorageBytes(bytes) {
  const next = Math.max(0, storageUsedBytes() + Number(bytes || 0));
  writeJson(STORAGE_KEY, { used: next, cap: STORAGE_CAP_BYTES, updatedAt: nowIso() });
  return next;
}
function countPdfPagesFromText(text) {
  const matches = String(text || "").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}
function readFileAsLatin1(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsBinaryString(file.slice(0, Math.min(file.size, 12 * 1024 * 1024)));
  });
}
function imageDimensions(file) {
  return new Promise((resolve) => {
    if (!isImage(file)) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { const result = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 }; URL.revokeObjectURL(url); resolve(result); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function validateFiles(files, existingCount = 0, context = "chat") {
  const accepted = [];
  const rejected = [];
  const warnings = [];
  const rolling = recentRollingUploads();
  const totalCount = existingCount + files.length;
  if (totalCount > MAX_FILES_PER_CHAT) {
    rejected.push(`Claude-style chat limit: max ${MAX_FILES_PER_CHAT} files per chat. Remove ${totalCount - MAX_FILES_PER_CHAT} file(s).`);
    return { accepted, rejected, warnings };
  }
  if (rolling.length + files.length > ROLLING_UPLOAD_MAX) {
    rejected.push(`Rolling upload limit reached: ${ROLLING_UPLOAD_MAX} uploads per 3 hours. Try again later or remove files.`);
    return { accepted, rejected, warnings };
  }
  const projectedStorage = storageUsedBytes() + files.reduce((sum, file) => sum + (file.size || 0), 0);
  if (projectedStorage > STORAGE_CAP_BYTES) {
    rejected.push(`Storage cap reached: ${bytesLabel(projectedStorage)} would exceed ${bytesLabel(STORAGE_CAP_BYTES)}.`);
    return { accepted, rejected, warnings };
  }

  for (const file of files) {
    const ext = fileExtension(file);
    if (!ACCEPTED_EXTENSIONS.has(ext) && !String(file.type || "").startsWith("image/")) {
      rejected.push(`${file.name}: unsupported type. Supported: PDF, DOCX, CSV, TXT, HTML, ODT, RTF, EPUB, JSON, XLSX, PPTX, JPEG, PNG, GIF, WebP.`);
      continue;
    }
    if (context === "project" && file.size > PROJECT_UPLOAD_MAX_BYTES) {
      rejected.push(`${file.name}: project files are limited to ${bytesLabel(PROJECT_UPLOAD_MAX_BYTES)}.`);
      continue;
    }
    if (file.size > CHAT_UPLOAD_MAX_BYTES) {
      rejected.push(`${file.name}: chat uploads are limited to ${bytesLabel(CHAT_UPLOAD_MAX_BYTES)}.`);
      continue;
    }
    if (isImage(file)) {
      if (file.size > IMAGE_MAX_BYTES) {
        rejected.push(`${file.name}: images are limited to ${bytesLabel(IMAGE_MAX_BYTES)}.`);
        continue;
      }
      const dims = await imageDimensions(file);
      if (dims && (dims.width > IMAGE_MAX_DIMENSION || dims.height > IMAGE_MAX_DIMENSION)) {
        rejected.push(`${file.name}: image dimensions ${dims.width}×${dims.height} exceed ${IMAGE_MAX_DIMENSION}×${IMAGE_MAX_DIMENSION}.`);
        continue;
      }
    }
    if (isSpreadsheet(file) && file.size > SPREADSHEET_MAX_BYTES) {
      rejected.push(`${file.name}: spreadsheets are limited to about ${bytesLabel(SPREADSHEET_MAX_BYTES)}.`);
      continue;
    }
    if (isTextLike(file)) {
      const estimatedTokens = Math.ceil((file.size || 0) / APPROX_CHARS_PER_TOKEN);
      if (estimatedTokens > TEXT_TOKEN_LIMIT) {
        rejected.push(`${file.name}: estimated ${estimatedTokens.toLocaleString()} tokens exceeds the 2M text/document token cap.`);
        continue;
      }
    }
    if (isPdf(file)) {
      const raw = await readFileAsLatin1(file);
      const pages = countPdfPagesFromText(raw);
      if (pages > 1000) warnings.push(`${file.name}: ${pages} PDF pages detected; Claude-style rule marks this as text-only processing.`);
      else if (pages > 100) warnings.push(`${file.name}: ${pages} PDF pages detected; visual PDF analysis is only guaranteed under 100 pages.`);
      else if (pages > 0) warnings.push(`${file.name}: ${pages} PDF pages detected; text + visual PDF analysis can be requested for charts/images/graphics.`);
    }
    accepted.push(file);
  }
  return { accepted, rejected, warnings };
}

function addBridgeStyle() {
  if (document.getElementById("streams-composer-parity-bridge-style")) return;
  const style = document.createElement("style");
  style.id = "streams-composer-parity-bridge-style";
  style.textContent = `
    .streamsDropTarget{position:fixed;inset:14px;z-index:9999;border:2px dashed rgba(34,211,238,.78);border-radius:24px;background:rgba(2,7,19,.78);display:grid;place-items:center;color:#fff;font:900 18px/1.25 Inter,system-ui;pointer-events:none;box-shadow:0 0 42px rgba(124,58,237,.36)}
    .streamsComposerParityToast{position:fixed;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9998;max-width:min(620px,calc(100vw - 24px));border:1px solid rgba(168,85,247,.38);border-radius:16px;background:rgba(15,23,42,.96);color:#fff;padding:10px 12px;font:750 12px/1.4 Inter,system-ui;box-shadow:0 18px 60px rgba(0,0,0,.36)}
    .streamsComposerParityToast b{display:block;color:#fff;margin-bottom:4px}.streamsComposerParityToast p{margin:4px 0;color:#e2e8f0}.streamsComposerParityToast button{margin-top:8px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:900;padding:7px 10px}
    .streamsProjectFilesPanel{margin-top:14px;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:rgba(15,23,42,.58);padding:12px;color:#eaf2ff}.streamsProjectFilesPanel h2{margin:0 0 8px;font-size:16px}.streamsProjectFilesPanel textarea,.streamsProjectFilesPanel input{width:100%;box-sizing:border-box;border:1px solid rgba(168,85,247,.32);border-radius:12px;background:rgba(2,7,19,.72);color:#fff;padding:9px;font:700 12px/1.35 Inter,system-ui}.streamsProjectFilesPanel button{border:0;border-radius:12px;background:#7c3aed;color:#fff;font-weight:900;padding:8px 10px}.streamsProjectFilesPanel .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.streamsProjectFilesPanel .file{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.14);border-radius:12px;padding:8px;background:rgba(2,7,19,.44);margin-top:6px}.streamsProjectFilesPanel small{display:block;color:#9fb3d6;margin-top:3px}.streamsProjectFilesPanel .warn{color:#fbbf24}.streamsProjectFilesPanel .storage{font-size:11px;color:#cbd5e1;margin:8px 0}
  `;
  document.head.appendChild(style);
}

function showToast(lines, title = "Upload notice", retryFiles = null, onUpload = null) {
  document.querySelector(".streamsComposerParityToast")?.remove();
  const el = document.createElement("div");
  el.className = "streamsComposerParityToast";
  el.innerHTML = `<b>${title}</b>${lines.map((line) => `<p>${String(line).replace(/[<>]/g, "")}</p>`).join("")}`;
  if (retryFiles?.length && onUpload) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Retry accepted files";
    btn.onclick = () => { onUpload(retryFiles); el.remove(); };
    el.appendChild(btn);
  }
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), retryFiles?.length ? 12000 : 8000);
}

function renderProjectPanel(chatRuntime, uploadToProject) {
  const module = Array.from(document.querySelectorAll(".module")).find((node) => /Open a brand or project/i.test(node.textContent || ""));
  if (!module || module.querySelector(".streamsProjectFilesPanel")) return;
  const project = ensureProject();
  const panel = document.createElement("section");
  panel.className = "streamsProjectFilesPanel";
  const currentChat = currentSessionId();
  const storageUsed = storageUsedBytes();
  panel.innerHTML = `
    <h2>Project files + instructions</h2>
    <div class="storage">Storage: ${bytesLabel(storageUsed)} / ${bytesLabel(STORAGE_CAP_BYTES)} · Rolling uploads: ${recentRollingUploads().length}/${ROLLING_UPLOAD_MAX}</div>
    <label><small>Project name</small><input data-project-name value="${project.name || "Current project"}" /></label>
    <label><small>Custom project instructions</small><textarea data-project-instructions rows="4" placeholder="Instructions that apply to future chats in this project">${project.instructions || ""}</textarea></label>
    <div class="row"><button type="button" data-save-project>Save project</button><button type="button" data-move-chat>Move current chat into project</button><button type="button" data-add-project-files>Add project files</button><button type="button" data-delete-project>Delete project files</button></div>
    <div data-project-list>${(project.files || []).length ? project.files.map((file) => `<div class="file"><div><b>${file.name}</b><small>${file.kind || "file"} · ${bytesLabel(file.sizeBytes || 0)}${file.pdfNote ? ` · <span class="warn">${file.pdfNote}</span>` : ""}</small></div><button type="button" data-remove-file="${file.id}">Remove</button></div>`).join("") : "<small>No project files yet.</small>"}</div>
  `;
  module.appendChild(panel);
  panel.querySelector("[data-save-project]")?.addEventListener("click", () => {
    const next = { ...project, name: panel.querySelector("[data-project-name]")?.value || project.name, instructions: panel.querySelector("[data-project-instructions]")?.value || "" };
    updateProject(next);
    showToast(["Project name and custom instructions saved. They persist for future project chats."], "Project saved");
  });
  panel.querySelector("[data-move-chat]")?.addEventListener("click", () => {
    const next = { ...ensureProject() };
    next.chatIds = Array.from(new Set([...(next.chatIds || []), currentChat]));
    updateProject(next);
    showToast([`Current chat ${currentChat} moved into this project context.`], "Chat moved");
  });
  panel.querySelector("[data-add-project-files]")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.json,.md,.html,.htm,.odt,.rtf,.epub";
    input.onchange = () => uploadToProject(Array.from(input.files || []));
    input.click();
  });
  panel.querySelector("[data-delete-project]")?.addEventListener("click", () => {
    const next = { ...ensureProject(), files: [] };
    updateProject(next);
    panel.remove();
    renderProjectPanel(chatRuntime, uploadToProject);
    showToast(["Project files removed. Chat uploads remain in their individual chat history."], "Project files deleted");
  });
  panel.querySelectorAll("[data-remove-file]").forEach((button) => button.addEventListener("click", () => {
    const id = button.getAttribute("data-remove-file");
    const next = { ...ensureProject(), files: (ensureProject().files || []).filter((file) => file.id !== id) };
    updateProject(next);
    panel.remove();
    renderProjectPanel(chatRuntime, uploadToProject);
  }));
}

export default function StreamsAIComposerParityBridge({ chatRuntime }) {
  const [dropActive, setDropActive] = useState(false);
  const lastAcceptedRef = useRef([]);
  const runtimeRef = useRef(chatRuntime);
  runtimeRef.current = chatRuntime;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    addBridgeStyle();
    const uploadFiles = async (files, context = "chat") => {
      const list = Array.from(files || []);
      if (!list.length) return;
      const existing = runtimeRef.current?.composerAttachments?.length || 0;
      const result = await validateFiles(list, existing, context);
      if (result.rejected.length || result.warnings.length) showToast([...result.rejected, ...result.warnings], result.rejected.length ? "Upload blocked" : "Upload rules", result.accepted, uploadFiles);
      if (!result.accepted.length) return;
      lastAcceptedRef.current = result.accepted;
      recordRollingUploads(result.accepted.length);
      addStorageBytes(result.accepted.reduce((sum, file) => sum + (file.size || 0), 0));
      if (context === "project") {
        const nextProject = { ...ensureProject() };
        const projectFiles = result.accepted.map((file) => ({ id: createId("project_file"), name: file.name, mimeType: file.type || "application/octet-stream", kind: isImage(file) ? "image" : isPdf(file) ? "pdf" : isSpreadsheet(file) ? "spreadsheet" : "file", sizeBytes: file.size, createdAt: nowIso(), pdfNote: isPdf(file) ? "PDF page rules checked before upload" : "" }));
        nextProject.files = [...projectFiles, ...(nextProject.files || [])];
        updateProject(nextProject);
        runtimeRef.current?.uploadFiles?.(result.accepted);
        window.setTimeout(() => document.querySelector(".streamsProjectFilesPanel")?.remove(), 50);
        window.setTimeout(() => renderProjectPanel(runtimeRef.current, (f) => uploadFiles(f, "project")), 80);
        return;
      }
      runtimeRef.current?.uploadFiles?.(result.accepted);
    };

    const onPaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter(Boolean);
      if (!files.length) return;
      event.preventDefault();
      uploadFiles(files, "chat");
    };
    const onDragOver = (event) => {
      if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
      event.preventDefault();
      setDropActive(true);
    };
    const onDragLeave = (event) => {
      if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) setDropActive(false);
    };
    const onDrop = (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      event.preventDefault();
      setDropActive(false);
      uploadFiles(files, "chat");
    };
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "r" && lastAcceptedRef.current.length) {
        event.preventDefault();
        uploadFiles(lastAcceptedRef.current, "chat");
      }
    };
    const renderInterval = window.setInterval(() => renderProjectPanel(runtimeRef.current, (f) => uploadFiles(f, "project")), 600);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearInterval(renderInterval);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return dropActive ? <div className="streamsDropTarget">Drop files to attach to this chat</div> : null;
}
