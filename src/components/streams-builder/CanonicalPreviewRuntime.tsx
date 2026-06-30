"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewPayload = {
  preview?: Record<string, any>;
  assets?: Array<Record<string, any>>;
  versions?: Array<Record<string, any>>;
};

function assetUrl(row: Record<string, any>) {
  const asset = row.asset || row;
  return asset.signedUrl || asset.signed_url || asset.public_url || asset.publicUrl || asset.previewUrl || asset.preview_url || asset.url || (asset.id ? `/api/streams-ai/assets/download?assetId=${asset.id}` : "");
}

function normalizeAssets(data: PreviewPayload) {
  return (data.assets || []).map((row) => {
    const asset = row.asset || row;
    const mimeType = asset.mime_type || asset.mimeType || "application/octet-stream";
    return {
      id: asset.id,
      role: row.role || "reference",
      name: asset.name || "Asset",
      kind: asset.kind || (String(mimeType).startsWith("image/") ? "image" : "file"),
      mimeType,
      previewUrl: assetUrl(row),
      signedUrl: assetUrl(row),
      textPreview: asset.textPreview || asset.metadata?.textPreview || "",
      summary: asset.summary || asset.metadata?.summary || "",
      processingStatus: asset.processingStatus || asset.metadata?.processingStatus || "ready",
    };
  });
}

function assetRuntimeScript(data: PreviewPayload) {
  const assets = normalizeAssets(data);
  return `<script>
window.__STREAMS_PREVIEW_CONTEXT__=${JSON.stringify({ previewId: data.preview?.id, projectId: data.preview?.project_id, sessionId: data.preview?.session_id, assets }).replace(/<\//g, "<\\/")};
window.StreamsPreviewAssets={all:function(){return window.__STREAMS_PREVIEW_CONTEXT__.assets||[]},byRole:function(role){return this.all().filter(function(asset){return asset.role===role})},first:function(role){return this.byRole(role)[0]||this.all()[0]||null}};
(function(){
  function card(asset){
    var url=asset.previewUrl||asset.signedUrl||"";
    var isImage=(asset.kind==="image"||/^image\//.test(asset.mimeType||""))&&url;
    var node=document.createElement("article");
    node.setAttribute("data-streams-asset-card",asset.role||"reference");
    node.style.cssText="border:1px solid rgba(15,23,42,.14);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 12px 32px rgba(15,23,42,.12);overflow:hidden;color:#0f172a;font-family:Inter,system-ui";
    node.innerHTML=(isImage?'<img src="'+url+'" alt="'+(asset.name||'asset')+'" style="width:100%;height:150px;object-fit:cover;display:block"/>':'')+'<div style="padding:12px"><b style="display:block;font-size:12px">'+(asset.name||'Asset')+'</b><span style="display:block;font-size:10px;text-transform:uppercase;color:#2563eb;margin-top:4px">'+(asset.role||'reference')+' · '+(asset.kind||'file')+'</span>'+(asset.summary?'<p style="font-size:12px;line-height:1.35;color:#475569;margin:8px 0 0">'+String(asset.summary).slice(0,220)+'</p>':'')+'</div>';
    return node;
  }
  function renderAssets(target){
    var assets=(window.__STREAMS_PREVIEW_CONTEXT__&&window.__STREAMS_PREVIEW_CONTEXT__.assets)||[];
    if(!assets.length||!target)return;
    target.innerHTML="";
    target.style.cssText=target.style.cssText||"";
    if(!target.style.display){target.style.display="grid";target.style.gridTemplateColumns="repeat(auto-fit,minmax(180px,1fr))";target.style.gap="14px";}
    assets.forEach(function(asset){target.appendChild(card(asset))});
  }
  document.addEventListener("DOMContentLoaded",function(){
    var explicit=document.querySelector("[data-streams-assets]");
    if(explicit){renderAssets(explicit);return;}
    var assets=(window.__STREAMS_PREVIEW_CONTEXT__&&window.__STREAMS_PREVIEW_CONTEXT__.assets)||[];
    if(!assets.length)return;
    var shelf=document.createElement("aside");
    shelf.setAttribute("data-streams-assets","auto");
    shelf.style.cssText="position:fixed;right:18px;bottom:18px;width:min(360px,calc(100vw - 36px));max-height:42vh;overflow:auto;z-index:999999;display:grid;gap:12px";
    document.body.appendChild(shelf);renderAssets(shelf);
  });
})();
</script>`;
}

function htmlWithContext(data: PreviewPayload) {
  const raw = String(data.preview?.preview_html || data.preview?.source_code || "").trim();
  if (!raw) return "";
  const contextScript = assetRuntimeScript(data);
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
  const versions = data.versions || [];
  const canRender = Boolean(srcDoc.trim());

  return (
    <section className={embedded ? "canonicalPreview embedded" : "canonicalPreview"}>
      <header>
        <div><strong>{title}</strong><span>{status === "ready" ? `${assets.length} linked asset${assets.length === 1 ? "" : "s"} · ${versions.length} version${versions.length === 1 ? "" : "s"}` : status}</span></div>
        {previewId ? <a href={`/streams-builder/preview/${previewId}`} target="_blank" rel="noreferrer">Open full preview</a> : null}
      </header>
      {canRender ? <iframe title={title} sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin" srcDoc={srcDoc} /> : <div className="noPreview"><strong>No renderable preview source is stored for this preview.</strong><p>Streams does not render placeholder previews. Generate or save real HTML, SVG, or preview source to this preview record.</p></div>}
      <style jsx>{`.canonicalPreview{width:100vw;height:100dvh;background:#020713;color:#eaf3ff;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.canonicalPreview.embedded{position:fixed;right:18px;top:72px;bottom:18px;width:min(680px,calc(100vw - 36px));height:auto;z-index:60;border:1px solid rgba(77,133,226,.34);border-radius:22px;box-shadow:0 24px 90px rgba(0,0,0,.42)}header{height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;border-bottom:1px solid rgba(148,163,184,.18);background:rgba(8,17,38,.96)}header div{min-width:0;display:flex;flex-direction:column}strong{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}span{font-size:11px;color:#8dabdb}a{color:#37e5ff;text-decoration:none;font-size:12px;font-weight:900}iframe{width:100%;height:100%;border:0;background:white}.noPreview{display:grid;place-content:center;gap:10px;text-align:center;padding:32px;color:#cfe3ff}.noPreview strong{font-size:18px;white-space:normal}.noPreview p{margin:0 auto;max-width:520px;color:#8dabdb;line-height:1.5}@media(max-width:900px){.canonicalPreview.embedded{left:10px;right:10px;top:70px;bottom:90px;width:auto}}`}</style>
    </section>
  );
}
