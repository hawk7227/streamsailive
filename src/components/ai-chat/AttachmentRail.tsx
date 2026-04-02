'use client';

import React, { useMemo, useRef, useState } from 'react';
import type { PendingAttachment } from '@/lib/ai-chat/context/types';
import type { FilePreviewManifest } from '@/lib/files/preview';

interface AttachmentRailProps {
  onAdd: (attachment: PendingAttachment) => void;
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
  if (!response.ok) {
    throw new Error(payload.error ?? 'Upload failed');
  }
  return payload;
}

function mapKind(file: File): PendingAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

export function AttachmentRail({ onAdd }: AttachmentRailProps) {
  const [tab, setTab] = useState<PendingAttachment['kind'] | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const tabs = useMemo(() => ([['url', 'URL'], ['image', 'Image'], ['video', 'Video'], ['document', 'Document'], ['audio', 'Audio']] as const), []);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file);
      onAdd({
        kind: mapKind(file),
        label: file.name,
        payload: uploaded.preview?.inlineText ?? uploaded.preview?.sourceUrl ?? file.name,
        fileId: uploaded.file?.id,
        mimeType: file.type || uploaded.file?.mime_type,
        metadata: { size: file.size, uploaded: true },
        preview: uploaded.preview,
      });
      setTab(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTab(tab === value ? null : value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${tab === value ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-transparent text-white/65 hover:border-white/20 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'url' ? (
        <div className="flex gap-2">
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a website or YouTube URL" className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35" />
          <button type="button" onClick={() => { if (!url.trim()) return; onAdd({ kind: 'url', label: url.trim(), payload: url.trim() }); setUrl(''); setTab(null); }} className="rounded-2xl bg-white px-4 text-sm font-semibold text-[#0A0C10]">Add</button>
        </div>
      ) : null}

      {tab === 'image' ? <button disabled={busy} type="button" onClick={() => imageRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 disabled:opacity-50">Select image</button> : null}
      {tab === 'video' ? <button disabled={busy} type="button" onClick={() => videoRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 disabled:opacity-50">Select video</button> : null}
      {tab === 'document' ? <button disabled={busy} type="button" onClick={() => documentRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 disabled:opacity-50">Select document</button> : null}
      {tab === 'audio' ? <button disabled={busy} type="button" onClick={() => audioRef.current?.click()} className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/75 disabled:opacity-50">Select audio</button> : null}

      {busy ? <div className="text-xs text-cyan-200">Uploading and indexing attachment…</div> : null}
      {error ? <div className="text-xs text-rose-300">{error}</div> : null}

      <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = ''; }} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = ''; }} />
      <input ref={documentRef} type="file" accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.ts,.tsx,.js,.jsx,.py,.sql,.html,.css,.xml,.yaml,.yml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = ''; }} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.currentTarget.value = ''; }} />
    </div>
  );
}
