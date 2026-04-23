"use client";

/**
 * FileUpload — shared file upload component for the Streams panel.
 * Accepts video (mp4/mov/webm) or image (jpg/png/webp/gif).
 * Uploads to Supabase Storage via a signed upload URL or direct POST.
 * Shows progress 0→100%. Returns the public URL via onUpload callback.
 *
 * Usage:
 *   <FileUpload accept="video" onUpload={(url) => handleIngest(url)} />
 *   <FileUpload accept="image" onUpload={(url) => setImageUrl(url)} label="Drop image" />
 */

import React, { useRef, useState, useCallback } from "react";
import { C, R, DUR, EASE } from "./tokens";

type Accept = "video" | "image" | "audio" | "any";
type UploadState = "idle" | "uploading" | "done" | "error";

interface FileUploadProps {
  accept?:    Accept;
  label?:     string;
  sublabel?:  string;
  onUpload:   (url: string, file: File) => void;
  onError?:   (msg: string) => void;
  disabled?:  boolean;
  compact?:   boolean;
}

const ACCEPT_MAP: Record<Accept, string> = {
  video: "video/mp4,video/quicktime,video/webm",
  image: "image/jpeg,image/png,image/webp,image/gif",
  audio: "audio/mpeg,audio/wav,audio/ogg",
  any:   "*/*",
};

const MAX_MB: Record<Accept, number> = {
  video: 500,
  image:  20,
  audio: 100,
  any:   500,
};

export default function FileUpload({
  accept   = "any",
  label    = "Upload file",
  sublabel,
  onUpload,
  onError,
  disabled = false,
  compact  = false,
}: FileUploadProps) {
  const inputRef   = useRef<HTMLInputElement>(null);
  const [state,    setState]    = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag,     setDrag]     = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function setErr(msg: string) {
    setErrorMsg(msg);
    setState("error");
    onError?.(msg);
  }

  const upload = useCallback(async (file: File) => {
    // Validate size
    const maxBytes = MAX_MB[accept] * 1024 * 1024;
    if (file.size > maxBytes) {
      setErr(`File too large — max ${MAX_MB[accept]}MB`);
      return;
    }

    setState("uploading");
    setProgress(0);
    setFileName(file.name);
    setErrorMsg(null);

    try {
      // Step 1: Get signed upload URL from our API
      const metaRes = await fetch("/api/streams/upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          filename:    file.name,
          contentType: file.type,
          size:        file.size,
        }),
      });

      if (!metaRes.ok) {
        const d = await metaRes.json() as { error?: string };
        setErr(d.error ?? "Upload init failed");
        return;
      }

      const { uploadUrl, publicUrl } = await metaRes.json() as {
        uploadUrl: string;
        publicUrl: string;
      };

      // Step 2: PUT to the signed URL with progress tracking via XMLHttpRequest
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setProgress(100);
      setState("done");
      onUpload(publicUrl, file);

    } catch (err) {
      setErr(err instanceof Error ? err.message : "Upload failed");
    }
  }, [accept, onUpload, onError]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }, [disabled]);

  const borderColor = state === "error" ? C.red
    : drag           ? C.acc
    : state === "done" ? C.green
    : C.bdr2;

  const bg = state === "done"   ? "rgba(16,185,129,0.06)"
           : state === "error"  ? "rgba(239,68,68,0.06)"
           : drag               ? C.accDim
           : C.bg3;

  if (compact) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input ref={inputRef} type="file" accept={ACCEPT_MAP[accept]}
          style={{ display:"none" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled || state === "uploading"}
          style={{
            padding:"8px 16px", borderRadius:R.r1, background:C.surf,
            border:`1px solid ${borderColor}`, color:C.t2, fontSize:13,
            fontFamily:"inherit", cursor:"pointer", display:"flex",
            alignItems:"center", gap:6,
            opacity: disabled ? 0.5 : 1,
          }}>
          {state === "uploading"
            ? <><Spinner size={10}/> {progress}%</>
            : state === "done"
            ? <>✓ {fileName}</>
            : <>↑ {label}</>}
        </button>
        {state === "error" && (
          <span style={{ fontSize:12, color:C.red }}>{errorMsg}</span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => !disabled && state !== "uploading" && inputRef.current?.click()}
      onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      style={{
        border: `1px dashed ${borderColor}`,
        borderRadius: R.r2,
        padding: "24px 16px",
        textAlign: "center",
        cursor: disabled || state === "uploading" ? "default" : "pointer",
        background: bg,
        transition: `all ${DUR.fast} ${EASE}`,
        userSelect: "none",
      }}>
      <input ref={inputRef} type="file" accept={ACCEPT_MAP[accept]}
        style={{ display:"none" }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)} />

      {state === "uploading" ? (
        <>
          <div style={{ marginBottom:8 }}><Spinner size={20}/></div>
          <div style={{ fontSize:14, color:C.t2, marginBottom:8 }}>{fileName}</div>
          <ProgressBar value={progress}/>
          <div style={{ fontSize:12, color:C.t4, marginTop:6 }}>{progress}%</div>
        </>
      ) : state === "done" ? (
        <>
          <div style={{ fontSize:20, color:C.green, marginBottom:6 }}>✓</div>
          <div style={{ fontSize:13, color:C.green, fontWeight:500 }}>{fileName}</div>
          <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); setState("idle"); setFileName(null); setProgress(0); }}
            style={{ marginTop:8, fontSize:12, color:C.t4, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
            Remove
          </button>
        </>
      ) : state === "error" ? (
        <>
          <div style={{ fontSize:20, color:C.red, marginBottom:6 }}>✗</div>
          <div style={{ fontSize:13, color:C.red, marginBottom:6 }}>{errorMsg}</div>
          <div style={{ fontSize:12, color:C.t4 }}>Click to try again</div>
        </>
      ) : (
        <>
          <div style={{ fontSize:24, color:C.t4, marginBottom:8, opacity:.4 }}>↑</div>
          <div style={{ fontSize:14, color:C.t1, fontWeight:500, marginBottom:4 }}>{label}</div>
          {sublabel && <div style={{ fontSize:12, color:C.t4 }}>{sublabel}</div>}
          {!sublabel && (
            <div style={{ fontSize:12, color:C.t4 }}>
              {accept === "video" ? "mp4 · mov · webm · max 500MB"
             : accept === "image" ? "jpg · png · webp · max 20MB"
             : accept === "audio" ? "mp3 · wav · ogg · max 100MB"
             : "Drop file or click to browse"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <span style={{
      display:"inline-block", width:size, height:size,
      borderRadius:"50%",
      border:`${Math.max(1.5, size/8)}px solid rgba(124,58,237,0.3)`,
      borderTopColor:C.acc,
      animation:"streams-spin 600ms linear infinite",
    }}/>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ width:"100%", height:4, borderRadius:R.pill, background:C.bg4, overflow:"hidden" }}>
      <div style={{
        height:"100%", borderRadius:R.pill, background:C.acc,
        width:`${value}%`,
        transition:`width ${DUR.fast} ${EASE}`,
      }}/>
    </div>
  );
}
