"use client";

import { useEffect, useState } from "react";

const DEFAULT_PROJECT_ID = "fb7bf446-78c9-4905-80bc-32a19d0f9803";

function isSupported(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(name);
}

export default function SafeReferenceUploadOverlay() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("Drop image references here. Avoids the Windows file-picker freeze.");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);

  async function uploadFile(file) {
    if (!file) return;
    if (!isSupported(file)) {
      setStatus("Use PNG, JPG, JPEG, or WEBP reference images for this safe uploader.");
      return;
    }
    setBusy(true);
    setStatus(`Uploading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", DEFAULT_PROJECT_ID);
      form.append("requestedProfile", "admin_full");
      form.append("referenceType", "safe-dropped-image-reference");

      const res = await fetch("/api/admingeneration/reference/upload-and-analyze", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) throw new Error(data?.error || `Upload failed (${res.status})`);

      const detail = {
        analysisId: data.analysisId || data.analysis?.id || "",
        assetId: data.asset?.assetId || null,
        url: data.asset?.sourceUrl || data.asset?.storage?.publicUrl || "",
        role: "safe-dropped-image-reference",
        source: "safe-reference-upload-overlay",
      };

      if (detail.analysisId) window.localStorage.setItem("streams:lastAnalysisId", detail.analysisId);
      window.dispatchEvent(new CustomEvent("streams:reference-uploaded", { detail }));
      window.dispatchEvent(new CustomEvent("streams:analysis-loaded", { detail: { analysisId: detail.analysisId } }));
      setLast(detail);
      setStatus(`Uploaded ${file.name}. Reference accepted${detail.analysisId ? ` · ${detail.analysisId.slice(0, 8)}…` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setDragging(false);
    }
  }

  useEffect(() => {
    function onPaste(event) {
      const file = Array.from(event.clipboardData?.files || []).find(isSupported);
      if (file) uploadFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <aside
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        const file = Array.from(event.dataTransfer?.files || []).find(isSupported);
        uploadFile(file);
      }}
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 2147483000,
        width: 320,
        borderRadius: 18,
        border: dragging ? "2px solid #a855f7" : "1px solid rgba(148,163,184,.35)",
        background: dragging ? "rgba(88,28,135,.96)" : "rgba(2,6,23,.92)",
        color: "#fff",
        boxShadow: "0 18px 60px rgba(0,0,0,.38)",
        padding: 14,
        fontFamily: "system-ui, sans-serif",
        backdropFilter: "blur(16px)",
      }}
    >
      <strong style={{ display: "block", fontSize: 13, marginBottom: 5 }}>Safe Reference Upload</strong>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.35, color: "#cbd5e1" }}>{status}</p>
      <small style={{ display: "block", marginTop: 8, color: busy ? "#fbbf24" : "#94a3b8" }}>
        {busy ? "Uploading…" : "Drag/drop or paste image here. No Explorer dialog needed."}
      </small>
      {last?.url ? (
        <button
          type="button"
          onClick={() => window.open(last.url, "_blank", "noopener,noreferrer")}
          style={{
            marginTop: 10,
            border: "1px solid rgba(255,255,255,.22)",
            background: "rgba(255,255,255,.08)",
            color: "#fff",
            borderRadius: 10,
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          Open uploaded reference
        </button>
      ) : null}
    </aside>
  );
}
