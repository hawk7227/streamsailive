"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  deleteLibraryFile,
  listGeneratedImages,
  listGeneratedVideos,
  listLibraryFiles,
} from "../../runtime/streamsAssetStore";
import "./streams-media-library-modal.css";

function assetUrl(asset = {}) {
  return asset.url || asset.publicUrl || asset.previewUrl || asset.storageUrl || asset.generatedVideoUrl || asset.artifactUrl || "";
}

function assetKind(asset = {}) {
  const mime = String(asset.mimeType || asset.mime_type || "").toLowerCase();
  if (asset.kind) return asset.kind;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}

function formatDate(value) {
  try {
    return value ? new Date(value).toLocaleString() : "";
  } catch {
    return "";
  }
}

function normalizeAsset(asset = {}, fallbackKind = "file") {
  const url = assetUrl(asset);
  const kind = assetKind(asset) || fallbackKind;
  return {
    ...asset,
    id: asset.id || asset.asset_id || url || asset.name,
    kind,
    name: asset.name || asset.title || (kind === "image" ? "Generated image" : kind === "video" ? "Generated video" : "Asset"),
    url,
    previewUrl: asset.previewUrl || asset.preview_url || url,
    storageUrl: asset.storageUrl || asset.storage_url || url,
    publicUrl: asset.publicUrl || asset.public_url || url,
    createdAt: asset.createdAt || asset.created_at || asset.updatedAt || asset.updated_at || "",
  };
}

function readAllAssets() {
  const seen = new Set();
  const assets = [
    ...listLibraryFiles().map((asset) => normalizeAsset(asset)),
    ...listGeneratedImages().map((asset) => normalizeAsset(asset, "image")),
    ...listGeneratedVideos().map((asset) => normalizeAsset(asset, "video")),
  ];

  return assets.filter((asset) => {
    const key = asset.id || asset.url || asset.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function downloadAsset(asset) {
  const url = assetUrl(asset);
  if (!url) return;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = asset.name || (asset.kind === "video" ? "streams-video.mp4" : "streams-image.png");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function copyAssetUrl(asset, setStatus) {
  const url = assetUrl(asset);
  if (!url) {
    setStatus("No URL available for this asset.");
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    setStatus("Copied asset URL.");
  } catch {
    setStatus("Could not copy URL in this browser.");
  }
}

function openAsset(asset) {
  const url = assetUrl(asset);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function MediaCard({ asset, onDelete, onStatus }) {
  const url = assetUrl(asset);
  const kind = assetKind(asset);

  return (
    <article className="streamsMediaCard">
      <button type="button" className="streamsMediaThumb" onClick={() => openAsset(asset)} disabled={!url}>
        {kind === "image" && url ? (
          <img src={url} alt={asset.name || "Generated image"} />
        ) : kind === "video" && url ? (
          <video src={url} muted playsInline preload="metadata" />
        ) : (
          <span>No preview URL</span>
        )}
      </button>

      <div className="streamsMediaMeta">
        <strong>{asset.name || "Untitled asset"}</strong>
        <span>{kind.toUpperCase()} {asset.createdAt ? `· ${formatDate(asset.createdAt)}` : ""}</span>
      </div>

      <div className="streamsMediaActions">
        <button type="button" onClick={() => openAsset(asset)} disabled={!url}>Open</button>
        <button type="button" onClick={() => copyAssetUrl(asset, onStatus)} disabled={!url}>Copy URL</button>
        <button type="button" onClick={() => downloadAsset(asset)} disabled={!url}>Download</button>
        {asset.id ? <button type="button" className="danger" onClick={() => onDelete(asset.id)}>Remove</button> : null}
      </div>
    </article>
  );
}

function SearchResult({ result }) {
  if (result.type === "session") {
    return (
      <article className="streamsSearchResult">
        <strong>{result.title || "Untitled chat"}</strong>
        <span>Chat session</span>
      </article>
    );
  }

  return (
    <article className="streamsSearchResult">
      <strong>{result.name || "Asset"}</strong>
      <span>{String(result.kind || "asset").toUpperCase()}</span>
    </article>
  );
}

export default function StreamsMediaLibraryModal({ mode = "images", chatRuntime, onClose }) {
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  const refresh = () => setAssets(readAllAssets());

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("streams:images-changed", onChange);
    window.addEventListener("streams:videos-changed", onChange);
    window.addEventListener("streams:chat-upload-complete", onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("streams:images-changed", onChange);
      window.removeEventListener("streams:videos-changed", onChange);
      window.removeEventListener("streams:chat-upload-complete", onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const visibleAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const media = mode === "images"
      ? assets.filter((asset) => assetKind(asset) === "image")
      : mode === "videos"
        ? assets.filter((asset) => assetKind(asset) === "video")
        : assets;

    if (!q) return media;
    return media.filter((asset) => {
      const text = `${asset.name || ""} ${asset.kind || ""} ${asset.mimeType || ""} ${asset.prompt || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [assets, mode, query]);

  const searchResults = useMemo(() => {
    if (mode !== "search") return [];
    const q = query.trim().toLowerCase();
    const sessionResults = (chatRuntime?.sessions || []).map((session) => ({
      ...session,
      type: "session",
      title: session.title || "Untitled chat",
    }));

    const assetResults = assets.map((asset) => ({ ...asset, type: "asset" }));
    const all = [...sessionResults, ...assetResults];

    if (!q) return all.slice(0, 60);
    return all.filter((item) => {
      const text = `${item.title || ""} ${item.name || ""} ${item.kind || ""}`.toLowerCase();
      return text.includes(q);
    }).slice(0, 60);
  }, [assets, chatRuntime?.sessions, mode, query]);

  function removeAsset(id) {
    deleteLibraryFile(id);
    refresh();
    setStatus("Removed from local media library view.");
  }

  const title = mode === "search" ? "Search" : mode === "videos" ? "Videos" : "Images";
  const subtitle =
    mode === "search"
      ? "Search real chats and saved media available in this workspace."
      : mode === "videos"
        ? "Real uploaded and generated videos saved in the STREAMS media store."
        : "Real uploaded and generated images saved in the STREAMS media store.";

  return (
    <div className="streamsMediaModalBackdrop" onClick={onClose} role="presentation">
      <section className="streamsMediaModal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="streamsMediaModalHeader">
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <div className="streamsMediaToolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={mode === "search" ? "Search chats and media…" : `Filter ${title.toLowerCase()}…`}
          />
          <button type="button" onClick={refresh}>Refresh</button>
        </div>

        {status ? <div className="streamsMediaStatus">{status}</div> : null}

        {mode === "search" ? (
          <div className="streamsSearchList">
            {searchResults.length ? (
              searchResults.map((result) => <SearchResult key={`${result.type}-${result.id || result.name || result.title}`} result={result} />)
            ) : (
              <div className="streamsMediaEmpty">No matching chats or media found.</div>
            )}
          </div>
        ) : (
          <div className="streamsMediaGrid">
            {visibleAssets.length ? (
              visibleAssets.map((asset) => (
                <MediaCard key={asset.id || asset.url || asset.name} asset={asset} onDelete={removeAsset} onStatus={setStatus} />
              ))
            ) : (
              <div className="streamsMediaEmpty">
                {mode === "videos" ? "No real videos are saved yet. Generated or uploaded videos will appear here after they are stored." : "No real images are saved yet. Generated or uploaded images will appear here after they are stored."}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
