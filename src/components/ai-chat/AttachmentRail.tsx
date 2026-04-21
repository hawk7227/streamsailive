'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { PendingAttachment } from '@/lib/ai-chat/context/types';
import type { FilePreviewManifest } from '@/lib/files/preview';

interface AttachmentRailProps {
  onAdd: (attachment: PendingAttachment) => void;
  /**
   * "dark"  — original dark-surface styles (default, preserves existing usage)
   * "light" — zinc-based styles for white/light backgrounds
   */
  variant?: 'dark' | 'light';
}

interface UploadResponse {
  ok?: boolean;
  error?: string;
  file?: { id: string; name: string; mime_type: string; size: number };
  preview?: FilePreviewManifest;
}

async function uploadAttachment(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/files/intake', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const payload = await response.json() as UploadResponse;
  if (!response.ok) throw new Error(payload.error ?? 'Upload failed');
  return payload;
}

function mapKind(file: File): PendingAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

export function AttachmentRail({ onAdd, variant = 'dark' }: AttachmentRailProps) {
  const [tab, setTab] = useState<PendingAttachment['kind'] | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef    = useRef<HTMLInputElement>(null);
  const videoRef    = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const audioRef    = useRef<HTMLInputElement>(null);

  const tabs = useMemo(
    () =>
      [
        ['url', 'URL'],
        ['image', 'Image'],
        ['video', 'Video'],
        ['document', 'Document'],
        ['audio', 'Audio'],
      ] as const,
    [],
  );

  // ── Per-variant class maps ─────────────────────────────────────────────
  const cx = useMemo(() => {
    if (variant === 'light') {
      return {
        wrap:       'grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3',
        tabBase:    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        tabActive:  'border-zinc-400 bg-zinc-200 text-zinc-900',
        tabInactive:'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700',
        input:      'flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400',
        addBtn:     'rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800',
        fileBtn:    'rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50',
        busyText:   'text-xs text-zinc-500',
        errorText:  'text-xs text-rose-600',
      };
    }
    return {
      wrap:       'grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3',
      tabBase:    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
      tabActive:  'border-white/20 bg-white/10 text-white',
      tabInactive:'border-white/10 bg-transparent text-white/65 hover:border-white/20 hover:text-white',
      input:      'flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35',
      addBtn:     'rounded-2xl bg-white px-4 text-sm font-semibold text-[#0A0C10]',
      fileBtn:    'rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 disabled:opacity-50',
      busyText:   'text-xs text-cyan-200',
      errorText:  'text-xs text-rose-300',
    };
  }, [variant]);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file);
      onAdd({
        kind:     mapKind(file),
        label:    file.name,
        payload:  uploaded.preview?.inlineText ?? uploaded.preview?.sourceUrl ?? file.name,
        fileId:   uploaded.file?.id,
        mimeType: file.type || uploaded.file?.mime_type,
        metadata: { size: file.size, uploaded: true },
        preview:  uploaded.preview,
      });
      setTab(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx.wrap}>
      {/* Tab row */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(tab === value ? null : value)}
            className={`${cx.tabBase} ${tab === value ? cx.tabActive : cx.tabInactive}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* URL input */}
      {tab === 'url' && (
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a website or YouTube URL"
            className={cx.input}
          />
          <button
            type="button"
            onClick={() => {
              if (!url.trim()) return;
              onAdd({ kind: 'url', label: url.trim(), payload: url.trim() });
              setUrl('');
              setTab(null);
            }}
            className={cx.addBtn}
          >
            Add
          </button>
        </div>
      )}

      {tab === 'image'    && <button disabled={busy} type="button" onClick={() => imageRef.current?.click()}    className={cx.fileBtn}>Select image</button>}
      {tab === 'video'    && <button disabled={busy} type="button" onClick={() => videoRef.current?.click()}    className={cx.fileBtn}>Select video</button>}
      {tab === 'document' && <button disabled={busy} type="button" onClick={() => documentRef.current?.click()} className={cx.fileBtn}>Select document</button>}
      {tab === 'audio'    && <button disabled={busy} type="button" onClick={() => audioRef.current?.click()}    className={cx.fileBtn}>Select audio</button>}

      {busy  && <div className={cx.busyText}>Uploading and indexing…</div>}
      {error && <div className={cx.errorText}>{error}</div>}

      {/* Hidden file inputs */}
      <input ref={imageRef}    type="file" accept="image/*"    className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ''; }} />
      <input ref={videoRef}    type="file" accept="video/*"    className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ''; }} />
      <input ref={documentRef} type="file" accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.ts,.tsx,.js,.jsx,.py,.sql,.html,.css,.xml,.yaml,.yml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ''; }} />
      <input ref={audioRef}    type="file" accept="audio/*"    className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.currentTarget.value = ''; }} />
    </div>
  );
}
