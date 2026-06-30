"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewPayload = {
  preview?: Record<string, any>;
  assets?: Array<Record<string, any>>;
  versions?: Array<Record<string, any>>;
};

function assetUrl(row: Record<string, any>) {
  const asset = row.asset || row;
  return asset.public_url || asset.publicUrl || asset.previewUrl || asset.preview_url || asset.url || (asset.id ? `/api/streams-ai/assets/download?assetId=${asset.id}` : "");
}

function buildContextScript(data: PreviewPayload) {
  const assets = (data.assets || []).map((row) => {
    const asset = row.asset || row;
    return {
      id: asset.id,
      role: row.role || "reference",
      name: asset.name || "Asset",
      kind: asset.kind || "file",
      mimeType: asset.mime_type || asset.mimeType || "application/octet-stream",
      previewUrl: assetUrl(row),
      signedUrl: assetUrl(row),
      textPreview: asset.textPreview || asset.metadata?.textPreview || "",
      summary: asset.summary || asset.metadata?.summary || "",
      processingStatus: asset.processingStatus || asset.metadata?.processingStatus || "ready",
    };
  });
  return `<script>window.__STREAMS_PREVIEW_CONTEXT__=${JSON.stringify({ previewId: data.preview?.id, projectId: data.preview?.project_id, sessionId: data.preview?.session_id, assets }).replace(/<\//g, "<\\/")};</script>`;
}

function htmlWithContext(data: PreviewPayload) {
  const raw = String(data.preview?.preview_html || data.preview?.source_code || "");
  const contextScript = buildContextScript(data);
  if (!raw.trim()) return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${contextScript}<main style="font-family:Inter,system-ui;padding:32px">Preview is empty.</main></body></html>`;
  if (/<\/head>/i.test(raw)) return raw.replace(/<\/head>/i, `${contextScript}</head>`);
  if (/<body[\s>]/i.test(raw)) return raw.replace(/<body([^>]*)>/i, `<body$1>${contextScript}`);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>${contextScript}${raw}</body></html>`;
}

export default function CanonicalPreviewRuntime({ previewId, embedded = false }: { previewId: string; embedded?: boolean }) {
  const [data, setData] = useState<PreviewPayload>({});
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setStatus("loading");
        const response = await fetch(`/api/streams-builder/previews/${encodeURIComponent(previewId)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || "Preview failed");
        if (!cancelled) {
          setData(payload);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }
    if (previewId) load();
    return () => { cancelled = true; };
  }, [previewId]);

  const srcDoc = useMemo(() => htmlWithContext(data), [data]);
  const title = data.preview?.title || "Streams Builder Preview";
  const assets = data.assets || [];

  return (
    <section className={embedded ? "canonicalPreview embedded" : "canonicalPreview"}>
      <header>
        <div><strong>{title}</strong><span>{status === "ready" ? `${assets.length} linked asset${assets.length === 1 ? "" : "s"}` : status}</span></div>
        {previewId ? <a href={`/streams-builder/preview/${previewId}`} target="_blank" rel="noreferrer">Open full preview</a> : null}
      </header>
      <iframe title={title} sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin" srcDoc={srcDoc} />
      <style jsx>{`.canonicalPreview{width:100vw;height:100dvh;background:#020713;color:#eaf3ff;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.canonicalPreview.embedded{position:fixed;right:18px;top:72px;bottom:18px;width:min(680px,calc(100vw - 36px));height:auto;z-index:60;border:1px solid rgba(77,133,226,.34);border-radius:22px;box-shadow:0 24px 90px rgba(0,0,0,.42)}header{height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;border-bottom:1px solid rgba(148,163,184,.18);background:rgba(8,17,38,.96)}header div{min-width:0;display:flex;flex-direction:column}strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}span{font-size:11px;color:#8dabdb}a{color:#37e5ff;text-decoration:none;font-size:12px;font-weight:900}iframe{width:100%;height:100%;border:0;background:white}@media(max-width:900px){.canonicalPreview.embedded{left:10px;right:10px;top:70px;bottom:90px;width:auto}}`}</style>
    </section>
  );
}
