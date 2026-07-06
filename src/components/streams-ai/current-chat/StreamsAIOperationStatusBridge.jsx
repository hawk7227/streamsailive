"use client";

import { useEffect } from "react";
import { canShowStreamsStatus, normalizeStatusText } from "./runtime/streamsStatusRegistry";

function emitStatus(statusText, detail = {}) {
  if (typeof window === "undefined") return;
  const text = normalizeStatusText(statusText);
  if (!canShowStreamsStatus(text)) return;
  window.dispatchEvent(new CustomEvent("streams:live-status", { detail: { statusText: text, ...detail } }));
}

function firstFileCount(body) {
  if (!(body instanceof FormData)) return 0;
  return body.getAll("file").length;
}

function assetStatus(asset = {}) {
  const mime = String(asset.mimeType || asset.mime_type || "").toLowerCase();
  const name = String(asset.name || "").toLowerCase();
  const mode = String(asset.extractionMode || asset.metadata?.extractionMode || "").toLowerCase();
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg)$/.test(name)) return "Audio uploaded";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/.test(name)) return "Video uploaded";
  if (mime.includes("pdf") || name.endsWith(".pdf") || mode === "pdf") return "Reading PDF…";
  if (/spreadsheet|excel|csv/.test(mime) || /\.(csv|xls|xlsx)$/.test(name) || ["spreadsheet", "csv"].includes(mode)) return "Reading spreadsheet…";
  if (/presentation|powerpoint/.test(mime) || /\.(ppt|pptx)$/.test(name) || mode === "presentation") return "Reading presentation…";
  if (/word|rtf|epub|opendocument/.test(mime) || /\.(doc|docx|rtf|odt|epub)$/.test(name)) return "Reading document…";
  if (/text|json|javascript|typescript|css|html|xml|yaml|sql|markdown/.test(mime) || /\.(txt|md|json|xml|html|htm|css|js|jsx|ts|tsx|sql|yaml|yml|log)$/.test(name)) return "Reading code…";
  return "Processing file…";
}

export default function StreamsAIOperationStatusBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.__streamsOperationStatusBridgeInstalled) return undefined;
    const originalFetch = window.fetch.bind(window);
    window.__streamsOperationStatusBridgeInstalled = true;

    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init?.method || "GET").toUpperCase();

      if (url === "/api/streams-ai/assets" && method === "POST") {
        const count = firstFileCount(init?.body);
        emitStatus("Checking file limits…", { source: "upload_validator", backendProof: { fileCount: count } });
        emitStatus(count > 1 ? `Uploading ${count} files…` : "Uploading 1 file…", { source: "upload_request", backendProof: { fileCount: count } });
        const response = await originalFetch(input, init);
        const data = await response.clone().json().catch(() => ({}));
        if (!response.ok || data?.ok === false || data?.success === false) {
          emitStatus("Upload failed", { source: "upload_request", backendProof: { httpStatus: response.status } });
          return response;
        }
        emitStatus("Upload complete", { source: "storage", backendProof: { httpStatus: response.status } });
        const assets = Array.isArray(data.assets) ? data.assets : Array.isArray(data.files) ? data.files : [];
        assets.slice(0, 4).forEach((asset) => emitStatus(assetStatus(asset), { source: "asset_processor", backendProof: { assetId: asset.id, fileType: asset.mimeType || asset.mime_type } }));
        if (assets.some((asset) => asset.textPreview || asset.textChunkCount || asset.summary)) emitStatus("Text extracted", { source: "asset_processor" });
        if (assets.some((asset) => asset.textChunkCount || asset.processingStatus === "ready" || asset.extractionStatus === "ready")) emitStatus("Extraction complete", { source: "asset_processor" });
        emitStatus("File ready", { source: "asset_processor", backendProof: { assetCount: assets.length } });
        return response;
      }

      if (url.startsWith("/api/streams-ai/projects")) {
        if (method === "GET") emitStatus("Loading project files…", { source: "project_store" });
        if (method === "POST" || method === "PATCH") emitStatus("Saving to project…", { source: "project_store" });
        const response = await originalFetch(input, init);
        if (response.ok && method === "GET") emitStatus("Project context loaded", { source: "project_store" });
        if (response.ok && (method === "POST" || method === "PATCH")) emitStatus("Project file saved", { source: "project_store" });
        return response;
      }

      if (url === "/api/admin-browser/check" && method === "POST") {
        emitStatus("Running checks…", { source: "repo_tool" });
        const response = await originalFetch(input, init);
        emitStatus(response.ok ? "Build complete" : "Build failed", { source: "repo_tool", backendProof: { httpStatus: response.status } });
        return response;
      }

      if (/deploy|deployment|vercel/i.test(url) && method !== "GET") {
        emitStatus("Deploying…", { source: "deployment_tool" });
        const response = await originalFetch(input, init);
        emitStatus(response.ok ? "Deployment ready" : "Build failed", { source: "deployment_tool", backendProof: { httpStatus: response.status } });
        return response;
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
      window.__streamsOperationStatusBridgeInstalled = false;
    };
  }, []);

  return null;
}
