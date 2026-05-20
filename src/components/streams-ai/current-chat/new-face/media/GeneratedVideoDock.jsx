"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addGeneratedImage,
  addGeneratedVideo,
  listGeneratedVideos,
  listLibraryFiles,
  updateGeneratedImage,
  updateGeneratedVideo,
  upsertLibraryFile,
} from "../../runtime/streamsAssetStore";
import VideoViewerModal from "./VideoViewerModal";

const VIDEO_WORKFLOWS = [
  { id: "uploaded_videos", title: "Uploaded Videos", desc: "Videos added from your files", method: "uploaded_videos" },
  { id: "snap_pic_click", title: "Snap Pic Click", desc: "Convert an image in 1 click", method: "snap_pic_click" },
  { id: "image_to_video", title: "Image to Video", desc: "Transform images into motion", method: "image_to_video" },
  { id: "text_to_video", title: "Text to Video", desc: "Create video from text", method: "text_to_video" },
  { id: "self_talk_video", title: "Self-Talk Video", desc: "Your talk, your vibe", method: "self_talk_video" },
  { id: "talking_video", title: "Talking Video", desc: "Make anyone talk", method: "talking_video" },
  { id: "ai_editor", title: "AI Editor", desc: "Edit, change, rebuild anything", method: "ai_editor" },
  { id: "image_generator", title: "Image Generator", desc: "Generate stunning images", method: "image_generator" },
  { id: "video_generator", title: "Video Generator", desc: "Advanced video generation", method: "video_generator" },
  { id: "audio_voice", title: "Audio / Voice", desc: "TTS, clone, lipsync and more", method: "audio_voice" },
  { id: "face_identity", title: "Face & Identity", desc: "Face swap and identity tools", method: "face_identity" },
  { id: "inpaint_retouch", title: "Inpaint / Retouch", desc: "Remove, fix, retouch images", method: "inpaint_retouch" },
  { id: "upscale_delivery", title: "Upscale & Delivery", desc: "Upscale and final delivery", method: "upscale_delivery" },
];

const DEFAULT_OVERLAYS = [
  { type: "text", text: "Snap Pic Click", start: 0.3, end: 2.1, x: "center", y: "18%", fontSize: 58, fontWeight: 800, color: "#ffffff", box: false },
  { type: "text", text: "Snap a photo. Pick a trend.", start: 0.8, end: 2.8, x: "center", y: "28%", fontSize: 28, fontWeight: 700, color: "#d8d8ff", box: false },
  { type: "text", text: "FaceTime With Myself", start: 3.0, end: 4.8, x: "center", y: "74%", fontSize: 30, fontWeight: 800, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.82", boxBorder: 18 },
  { type: "text", text: "Your viral clip is ready", start: 6.1, end: 8.0, x: "center", y: "16%", fontSize: 38, fontWeight: 800, color: "#ffffff", box: true, boxColor: "black@0.45", boxBorder: 16 },
];

const MOTIVATE_MYSELF_OVERLAYS = [
  { type: "text", text: "Future Me called.", start: 0.3, end: 2.0, x: "center", y: "16%", fontSize: 54, fontWeight: 800, color: "#ffffff", box: false },
  { type: "text", text: "Lock in.", start: 2.1, end: 4.4, x: "center", y: "74%", fontSize: 34, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x111827@0.72", boxBorder: 18 },
  { type: "text", text: "One focused hour.", start: 4.5, end: 6.3, x: "center", y: "74%", fontSize: 30, fontWeight: 900, color: "#ffffff", box: true, boxColor: "0x7c3aed@0.82", boxBorder: 18 },
  { type: "text", text: "You already know what to do.", start: 6.4, end: 8.0, x: "center", y: "16%", fontSize: 34, fontWeight: 900, color: "#ffffff", box: true, boxColor: "black@0.48", boxBorder: 16 },
];

function emitVideoChange() { window.dispatchEvent(new Event("streams:videos-changed")); }
function emitImageChange() { window.dispatchEvent(new Event("streams:images-changed")); }

function normalizeUploadedVideo(file) {
  const url = file?.previewUrl || file?.storageUrl || file?.url || "";
  return {
    ...file,
    id: file?.id || file?.storageUrl || file?.previewUrl,
    kind: "video",
    source: "uploaded",
    method: "uploaded_videos",
    status: "ready",
    statusText: "Uploaded video",
    name: file?.name || "Uploaded video",
    url,
    storageUrl: file?.storageUrl || url,
    previewUrl: file?.previewUrl || url,
    mimeType: file?.mimeType || "video/mp4",
  };
}

function readVideos() {
  try {
    const generated = listGeneratedVideos();
    const uploaded = listLibraryFiles()
      .filter((file) => file?.kind === "video" || String(file?.mimeType || "").startsWith("video/"))
      .map(normalizeUploadedVideo);
    const seen = new Set();
    return [...uploaded, ...generated].filter((video) => {
      const key = video?.id || video?.url || video?.previewUrl;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "completed" || value === "ready") return "ready";
  if (value === "failed" || value === "error") return "failed";
  return "rendering";
}
function isImageMime(mimeType = "") { return String(mimeType || "").toLowerCase().startsWith("image/"); }
function methodForVideo(video = {}) {
  if (video.source === "uploaded") return "uploaded_videos";
  return video.method || video.workflow || video.module || (String(video.prompt || "").toLowerCase().includes("image to video") ? "image_to_video" : "text_to_video");
}
function formatDate(value) { try { return value ? new Date(value).toLocaleString() : ""; } catch { return ""; } }
function videoKey(video, index) { return video?.id || video?.generationId || video?.url || `video-${index}`; }
function autoOpenKey(video) { return video?.id || video?.generationId || video?.url || ""; }
function canFinalize(video = {}) { return Boolean(video?.url && video.source !== "uploaded" && !video.finalized && video.finalizeStatus !== "processing"); }
function isMotivateMyself(video = {}) {
  const text = `${video.prompt || ""} ${video.method || ""} ${video.workflow || ""} ${video.intent || ""} ${video.action || ""}`.toLowerCase();
  return text.includes("motivate myself") || text.includes("motivate_myself") || text.includes("motivation") || text.includes("future me") || text.includes("determination");
}

function defaultVoiceoverScript(video = {}) {
  if (isMotivateMyself(video)) {
    return "You already know what you want. Now act like it. One focused hour today can change the whole direction of your life.";
  }
  const prompt = String(video.prompt || "").toLowerCase();
  if (prompt.includes("snap pic click") || prompt.includes("make me viral")) return "Snap a photo. Pick a trend. Create a viral video in seconds.";
  return "Your video is ready. Add exact text, voiceover, and share it anywhere.";
}

function defaultOverlaysForVideo(video = {}) {
  return isMotivateMyself(video) ? MOTIVATE_MYSELF_OVERLAYS : DEFAULT_OVERLAYS;
}

function addImageToLibrary({ id, name, url, mimeType, prompt, provider, model, size, status = "ready", artifactPersisted = false }) {
  const now = new Date().toISOString();
  const image = { id, kind: "image", source: "generated", name, status, statusText: status === "ready" ? "Image ready" : "Generating image…", mimeType: mimeType || "image/png", url: url || "", storageUrl: artifactPersisted ? url || "" : "", previewUrl: url || "", prompt: prompt || "", provider: provider || "fal", model: model || "", size, artifactPersisted, createdAt: now, updatedAt: now };
  addGeneratedImage(image);
  upsertLibraryFile({ id, kind: "image", source: "generated", name, mimeType: image.mimeType, sizeBytes: 0, storageUrl: image.storageUrl || image.previewUrl, previewUrl: image.previewUrl, createdAt: now });
  emitImageChange();
}

function useIsMobileDock() {
  const read = () => typeof window !== "undefined" && window.innerWidth <= 760;
  const [isMobile, setIsMobile] = useState(read);
  useEffect(() => { const update = () => setIsMobile(read()); update(); window.addEventListener("resize", update); window.addEventListener("orientationchange", update); return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); }; }, []);
  return isMobile;
}

function overlayStyle(overlay) {
  const style = { position: "absolute", left: overlay.x === "left" ? "8%" : overlay.x === "right" ? "auto" : "50%", right: overlay.x === "right" ? "8%" : "auto", top: overlay.y || "50%", transform: overlay.x === "center" ? "translateX(-50%)" : "none", color: overlay.color || "#fff", fontSize: Math.max(14, Math.min(40, Number(overlay.fontSize || 30) * 0.55)), fontWeight: overlay.fontWeight || 800, textAlign: "center", maxWidth: "88%", lineHeight: 1.05, padding: overlay.box ? "8px 12px" : 0, borderRadius: overlay.box ? 16 : 0, background: overlay.box ? "rgba(124,58,237,.78)" : "transparent", textShadow: "0 2px 10px rgba(0,0,0,.6)", pointerEvents: "none" };
  return style;
}

function FinalizePreviewDrawer({ video, onClose, onFinalized }) {
  const [script, setScript] = useState(() => video?.voiceoverScript || defaultVoiceoverScript(video));
  const [overlays, setOverlays] = useState(() => video?.overlays || defaultOverlaysForVideo(video));
  const [voiceover, setVoiceover] = useState(video?.voiceover || null);
  const [status, setStatus] = useState("Preview overlays and voiceover before final render.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScript(video?.voiceoverScript || defaultVoiceoverScript(video));
    setOverlays(video?.overlays || defaultOverlaysForVideo(video));
    setVoiceover(video?.voiceover || null);
    setStatus("Preview overlays and voiceover before final render.");
  }, [video]);

  if (!video) return null;
  const updateOverlayText = (index, text) => setOverlays((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item));

  async function generateVoiceover() {
    setBusy(true);
    setStatus("Generating voiceover preview…");
    try {
      const response = await fetch("/api/streams/voiceover/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: script, name: `${video.name || "video"}-voiceover` }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.audioUrl) throw new Error(data?.error || "Voiceover preview failed.");
      setVoiceover(data);
      updateGeneratedVideo(video.id, { voiceover: data, voiceoverScript: script, overlays, updatedAt: new Date().toISOString() });
      emitVideoChange();
      setStatus("Voiceover preview ready. Press play before finalizing.");
    } catch (error) { setStatus(error?.message || "Voiceover preview failed."); }
    finally { setBusy(false); }
  }

  async function finalizeVideo() {
    setBusy(true);
    setStatus("Finalizing MP4 with exact overlays and audio…");
    updateGeneratedVideo(video.id, { finalizeStatus: "processing", statusText: "Finalizing MP4…", voiceoverScript: script, overlays, updatedAt: new Date().toISOString() });
    emitVideoChange();
    try {
      const response = await fetch("/api/streams/video/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoUrl: video.url, name: video.name || "snap-pic-click-final", voiceoverScript: voiceover?.audioUrl ? "" : script, voiceoverUrl: voiceover?.audioUrl || "", overlays, audioMode: "preserve", sourceVolume: 0.9, voiceVolume: 1, musicVolume: 0.22 }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false || !data?.artifactUrl) throw new Error(data?.error || "Final video render failed.");
      const now = new Date().toISOString();
      const patch = { name: isMotivateMyself(video) ? "Motivate Myself" : "Final video", url: data.artifactUrl, storageUrl: data.artifactUrl, previewUrl: data.artifactUrl, originalUrl: video.url, finalVideoUrl: data.artifactUrl, finalized: true, finalizeStatus: "completed", status: "ready", statusText: "Final MP4 ready", mimeType: data.mimeType || "video/mp4", artifactPersisted: data.artifactPersisted === true, voiceover: data.voiceover || voiceover || null, overlay: data.overlay || null, overlays, voiceoverScript: script, updatedAt: now };
      updateGeneratedVideo(video.id, patch);
      upsertLibraryFile({ id: video.id, kind: "video", source: "generated", name: patch.name, mimeType: patch.mimeType, sizeBytes: data.sizeBytes || 0, storageUrl: patch.storageUrl, previewUrl: patch.previewUrl, createdAt: video.createdAt || now });
      emitVideoChange();
      onFinalized({ ...video, ...patch });
      setStatus("Final MP4 ready.");
    } catch (error) {
      updateGeneratedVideo(video.id, { finalizeStatus: "failed", status: "ready", statusText: `Final render failed: ${error?.message || "Unknown error"}`, updatedAt: new Date().toISOString() });
      emitVideoChange();
      setStatus(error?.message || "Final render failed.");
    } finally { setBusy(false); }
  }

  return (
    <section style={{ position: "fixed", right: 18, bottom: 18, zIndex: 1700, width: "min(520px, calc(100vw - 28px))", maxHeight: "88dvh", overflow: "auto", border: "1px solid #dedede", borderRadius: 22, background: "#fff", boxShadow: "0 24px 80px rgba(0,0,0,.24)" }} aria-label="Finalize video preview">
      <header style={{ minHeight: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 14px", borderBottom: "1px solid #eee" }}><div><strong>{isMotivateMyself(video) ? "Preview Motivate Myself" : "Preview final version"}</strong><span style={{ display: "block", color: "#777", fontSize: 12 }}>Edit overlays and prehear voiceover first.</span></div><button type="button" onClick={onClose} style={{ width: 34, height: 34, border: 0, borderRadius: 999, background: "#f5f5f5" }}>×</button></header>
      <div style={{ padding: 14 }}><div style={{ position: "relative", aspectRatio: "9 / 16", maxHeight: 460, margin: "0 auto 14px", borderRadius: 18, overflow: "hidden", background: "#111" }}><video src={video.url} controls playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />{overlays.map((overlay, index) => <div key={`${overlay.text}-${index}`} style={overlayStyle(overlay)}>{overlay.text}</div>)}</div><label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#555", marginBottom: 6 }}>VOICEOVER SCRIPT</label><textarea value={script} onChange={(event) => setScript(event.target.value)} style={{ width: "100%", minHeight: 74, border: "1px solid #ddd", borderRadius: 14, padding: 10, resize: "vertical" }} /><div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}><button type="button" disabled={busy || !script.trim()} onClick={generateVoiceover} style={{ height: 36, border: "1px solid #111", borderRadius: 999, background: "#111", color: "#fff", padding: "0 14px", fontWeight: 800 }}>Generate / prehear voice</button>{voiceover?.audioUrl ? <audio src={voiceover.audioUrl} controls style={{ height: 36, maxWidth: "100%" }} /> : null}</div><label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#555", margin: "12px 0 6px" }}>OVERLAY TEXT</label><div style={{ display: "grid", gap: 8 }}>{overlays.map((overlay, index) => <input key={index} value={overlay.text} onChange={(event) => updateOverlayText(index, event.target.value)} style={{ height: 36, border: "1px solid #ddd", borderRadius: 12, padding: "0 10px" }} />)}</div><p style={{ color: status.includes("failed") || status.includes("error") ? "#b00020" : "#666", fontSize: 12, margin: "12px 0" }}>{status}</p><button type="button" disabled={busy} onClick={finalizeVideo} style={{ width: "100%", height: 46, border: 0, borderRadius: 999, background: "linear-gradient(135deg,#7c3aed,#111827)", color: "#fff", fontWeight: 900 }}>{busy ? "Working…" : "Finalize MP4"}</button></div>
    </section>
  );
}

function VideoCard({ video, ready, failed, onOpenViewer, onPreviewFinalize }) {
  const needsFinalize = canFinalize(video);
  return <button type="button" disabled={!ready} onClick={() => ready && (needsFinalize ? onPreviewFinalize(video) : onOpenViewer(video))} style={{ border: failed ? "1px solid #ffd2d2" : ready ? "1px solid #dff0df" : "1px solid #eeeeee", background: ready ? "#fbfffb" : failed ? "#fff7f7" : "#fff", borderRadius: 14, padding: 8, textAlign: "left", cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.9 }}><div style={{ aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", background: "#111", display: "grid", placeItems: "center", marginBottom: 8 }}>{ready ? <video src={video.url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#777", fontSize: 12 }}>Rendering</span>}</div><span style={{ display: "block", fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.name || "Generated video"}</span><span style={{ display: "block", marginTop: 4, color: failed ? "#b00020" : ready ? "#167c35" : "#777", fontSize: 11 }}>{needsFinalize ? "Preview / finalize before MP4" : ready ? "Ready — click to play" : failed ? (video.statusText || "Video failed") : (video.statusText || "Waiting on provider…")}</span>{video.createdAt ? <span style={{ display: "block", marginTop: 4, color: "#999", fontSize: 10 }}>{formatDate(video.createdAt)}</span> : null}</button>;
}

export default function GeneratedVideoDock() {
  const [videos, setVideos] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewerVideo, setViewerVideo] = useState(null);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const autoOpenedVideoIdRef = useRef(null);
  const isMobile = useIsMobileDock();
  const refresh = () => setVideos(readVideos());

  useEffect(() => installMediaFetchTracker(), []);
  useEffect(() => { const openGrid = () => setOpen(true); window.addEventListener("streams:open-generated-videos", openGrid); return () => window.removeEventListener("streams:open-generated-videos", openGrid); }, []);
  useEffect(() => { refresh(); const onStorage = (event) => { if (!event.key || event.key === "streams.generated.videos.v1" || event.key === "streams.library.files.v1") refresh(); }; const interval = window.setInterval(refresh, 1500); window.addEventListener("storage", onStorage); window.addEventListener("focus", refresh); window.addEventListener("streams:videos-changed", refresh); return () => { window.clearInterval(interval); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", refresh); window.removeEventListener("streams:videos-changed", refresh); }; }, []);
  useEffect(() => { const readyVideo = videos.find((video) => video?.url && video.status !== "failed" && (video.source !== "generated" || video.finalized || video.finalizeStatus === "failed")); const key = autoOpenKey(readyVideo); if (!readyVideo || !key || autoOpenedVideoIdRef.current === key) return; autoOpenedVideoIdRef.current = key; setViewerVideo(readyVideo); }, [videos]);

  const workflows = VIDEO_WORKFLOWS.map((workflow) => { const matching = videos.filter((video) => methodForVideo(video) === workflow.method || (workflow.method === "text_to_video" && !methodForVideo(video))); const latest = matching.find((video) => video.url) || matching[0] || null; return { ...workflow, latest, count: matching.length }; });
  const shownVideos = selectedWorkflow ? videos.filter((video) => methodForVideo(video) === selectedWorkflow.method) : [];
  const label = selectedWorkflow ? selectedWorkflow.title : "Video Studio";
  const dockStyle = isMobile ? { position: "fixed", left: open ? 0 : 16, right: open ? 0 : "auto", bottom: open ? 0 : 92, zIndex: 900, width: open ? "100vw" : 52, maxHeight: open ? "86dvh" : 52, border: "1px solid rgba(222,222,222,.92)", borderRadius: open ? "22px 22px 0 0" : 18, background: "rgba(255,255,255,0.97)", boxShadow: "0 -18px 54px rgba(0,0,0,0.16)", overflow: "hidden", transition: "all .18s ease" } : { position: "fixed", left: 82, top: 86, zIndex: 900, width: open ? 760 : 52, maxHeight: "calc(100dvh - 150px)", border: "1px solid rgba(222,222,222,.92)", borderRadius: 18, background: "rgba(255,255,255,0.96)", boxShadow: "0 18px 54px rgba(0,0,0,0.14)", overflow: "hidden", transition: "width .18s ease" };

  return <><aside aria-label="Generated videos" style={dockStyle}><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open ? "true" : "false"} style={{ width: "100%", height: 52, border: 0, background: "#f5fff7", display: "flex", alignItems: "center", gap: 10, padding: open ? "0 14px" : 0, justifyContent: open ? "space-between" : "center", fontWeight: 800, cursor: "pointer" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span aria-hidden="true">▶</span>{open ? <span>{label}</span> : null}</span>{open ? <span aria-hidden="true">×</span> : null}</button>{open ? <div style={{ borderTop: "1px solid #ededed", maxHeight: isMobile ? "calc(86dvh - 52px)" : "calc(100dvh - 202px)", overflow: "auto", padding: 12 }}>{selectedWorkflow ? <button type="button" onClick={() => setSelectedWorkflow(null)} style={{ height: 34, border: "1px solid #ddd", borderRadius: 999, background: "#fff", padding: "0 12px", marginBottom: 10 }}>← All workflows</button> : null}{!selectedWorkflow ? <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 10 }}>{workflows.map((workflow) => { const ready = Boolean(workflow.latest?.url); return <button key={workflow.id} type="button" onClick={() => setSelectedWorkflow(workflow)} style={{ border: "1px solid #e8e8e8", background: "#fff", borderRadius: 14, padding: 8, textAlign: "left", cursor: "pointer" }}><div style={{ aspectRatio: "16/9", borderRadius: 10, overflow: "hidden", background: "linear-gradient(135deg,#151515,#343047)", display: "grid", placeItems: "center", color: "#fff", marginBottom: 8 }}>{ready ? <video src={workflow.latest.url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 12 }}>{workflow.title}</span>}</div><strong style={{ display: "block", fontSize: 13 }}>{workflow.title}</strong><span style={{ display: "block", color: "#777", fontSize: 11, marginTop: 2 }}>{workflow.desc}</span><em style={{ display: "inline-block", marginTop: 8, fontStyle: "normal", color: ready ? "#167c35" : "#777", fontSize: 11 }}>{workflow.count ? `${workflow.count} file${workflow.count === 1 ? "" : "s"}` : "No files yet"}</em></button>; })}</div> : <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 10 }}>{shownVideos.length ? shownVideos.map((video, index) => { const ready = Boolean(video.url); const failed = video.status === "failed"; return <VideoCard key={videoKey(video, index)} video={video} ready={ready} failed={failed} onOpenViewer={setViewerVideo} onPreviewFinalize={setPreviewVideo} />; }) : <div style={{ border: "1px dashed #ddd", borderRadius: 14, padding: 18, color: "#777", fontSize: 13 }}>No saved files for {selectedWorkflow.title} yet.</div>}</div>}</div> : null}</aside><FinalizePreviewDrawer video={previewVideo} onClose={() => setPreviewVideo(null)} onFinalized={(video) => { setPreviewVideo(null); setViewerVideo(video); refresh(); }} /><VideoViewerModal open={Boolean(viewerVideo?.url)} video={viewerVideo} onClose={() => setViewerVideo(null)} onDownload={(video) => { if (!video?.url) return; const anchor = document.createElement("a"); anchor.href = video.url; anchor.download = video.name || "generated-video.mp4"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }} /></>;
}
