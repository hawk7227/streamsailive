"use client";

import React, { useEffect, useRef, useState } from "react";
import "./snap-pic-click-capture.css";

const LIBRARY_KEY = "streams-ai.assets.cache.v1";

function readLibraryFiles() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibraryFiles(files) {
  const seen = new Set();
  const unique = files.filter((file) => {
    const key = file?.id || file?.storageUrl || file?.previewUrl || file?.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 300);
  window.sessionStorage.setItem(LIBRARY_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event("streams:videos-changed"));
  window.dispatchEvent(new Event("streams:images-changed"));
}

async function uploadBlob(blob, filename) {
  const form = new FormData();
  form.append("file", new File([blob], filename, { type: blob.type || "application/octet-stream" }));
  const response = await fetch("/api/streams-ai/assets", { method: "POST", body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false || data?.success === false) throw new Error(data?.error || "Upload failed");
  const assets = Array.isArray(data.assets) ? data.assets : [];
  writeLibraryFiles([...assets, ...readLibraryFiles()]);
  return assets[0] || null;
}

async function analyzeAsset(asset, intent) {
  const response = await fetch("/api/streams/capture/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset, intent }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Analyze failed");
  return data;
}

export default function SnapPicClickCapture() {
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("photo");
  const [intent, setIntent] = useState("main_character");
  const [status, setStatus] = useState("Ready to capture.");
  const [recording, setRecording] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [lastAsset, setLastAsset] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    async function start() {
      try {
        setStatus("Requesting device permission…");
        const constraints = mode === "audio"
          ? { audio: true, video: false }
          : { audio: mode === "video", video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && mode !== "audio") videoRef.current.srcObject = stream;
        setStatus(mode === "audio" ? "Microphone ready. Record a clear sample." : "Camera ready. Keep the subject centered and use bright light.");
      } catch (error) {
        setStatus(error?.message || "Device permission failed.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, mode]);

  async function saveAndAnalyze(blob, filename) {
    setStatus("Saving capture to library…");
    const asset = await uploadBlob(blob, filename);
    setLastAsset(asset);
    setStatus("Analyzing capture quality…");
    const result = await analyzeAsset(asset, intent);
    setAnalysis(result);
    setStatus(result.canProceed ? "Capture saved and ready to use." : "Capture saved. Review analyzer guidance before use.");
  }

  async function takePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    await saveAndAnalyze(blob, `snap-pic-click-photo-${Date.now()}.jpg`);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = mode === "audio" ? "audio/webm" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await saveAndAnalyze(blob, `snap-pic-click-${mode}-${Date.now()}.webm`);
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    setStatus(mode === "audio" ? "Recording audio sample…" : "Recording video sample…");
  }

  function stopRecording() {
    recorderRef.current?.stop?.();
  }

  return (
    <>
      {open ? null : null}
      {open ? (
        <section className="spc-panel" aria-label="Snap Pic Click capture">
          <header>
            <div><strong>Snap Pic Click Capture</strong><span>Capture photo, video, or audio and auto-save it to your library.</span></div>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="spc-tabs">{["photo", "video", "audio"].map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => { setMode(item); setAnalysis(null); }}>{item}</button>)}</div>
          <label className="spc-intent"><span>Use as</span><select value={intent} onChange={(event) => setIntent(event.target.value)}><option value="main_character">Main Character</option><option value="motivate_myself">Motivate Myself</option><option value="future_version">Future Version</option><option value="younger_version">Younger Version</option><option value="older_version">Older Version</option><option value="voice_style">Voice Style</option><option value="talking_video">Talking Video</option><option value="image_to_video">Image to Video</option></select></label>
          {intent === "motivate_myself" ? <div className="spc-motivate-note"><strong>Motivate Myself</strong><span>Use this capture for a FaceTime-style motivational clip from your stronger/future self. Default tone: Future Me + Determination.</span></div> : null}
          <div className="spc-preview">{mode === "audio" ? <div className="spc-voice-guide">Record a clear audio sample in a quiet room. For personal-use styles, say: “I confirm this recording is mine and can be used for my account outputs.”</div> : <video ref={videoRef} autoPlay playsInline muted />}</div>
          <div className="spc-actions">{mode === "photo" ? <button onClick={takePhoto}>Take Photo</button> : recording ? <button onClick={stopRecording}>Stop Recording</button> : <button onClick={startRecording}>Start Recording</button>}</div>
          <p className="spc-status">{status}</p>
          {analysis ? <div className="spc-analysis"><strong>Analyzer score: {analysis.score}/100</strong><span>{analysis.canProceed ? "Good enough to continue." : "Retake recommended."}</span><ul>{(analysis.guidance || []).map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
          {lastAsset ? <div className="spc-saved">Saved: {lastAsset.name}</div> : null}
        </section>
      ) : null}
    </>
  );
}
