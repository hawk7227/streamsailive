'use client';

import type { FilePreviewManifest } from '@/lib/files/preview';

interface AttachmentPreviewDialogProps {
  preview: FilePreviewManifest | null;
  onClose: () => void;
}

function RepresentationLinks({ preview }: { preview: FilePreviewManifest }) {
  if (!preview.representations?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {preview.representations.map((representation) => (
        <a
          key={`${representation.kind}-${representation.url}`}
          href={representation.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/12 px-3 py-1.5 text-[11px] text-white/75 hover:border-white/20 hover:text-white"
        >
          {representation.label}
        </a>
      ))}
    </div>
  );
}

export function AttachmentPreviewDialog({ preview, onClose }: AttachmentPreviewDialogProps) {
  if (!preview) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/12 bg-[#07111f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">{preview.title}</div>
            <div className="text-xs text-white/45">{preview.kind.toUpperCase()} • {preview.mimeType}</div>
          </div>
          <div className="flex items-center gap-2">
            <a href={preview.downloadUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/80">Open</a>
            <button type="button" onClick={onClose} className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/80">Close</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,.8fr)]">
          <div className="min-h-[320px] rounded-2xl border border-white/10 bg-black/25 p-3">
            {preview.media?.kind === 'image' ? (
              <img src={preview.media.url} alt={preview.title} className="mx-auto max-h-[72vh] rounded-2xl object-contain" />
            ) : null}
            {preview.media?.kind === 'video' ? (
              <div className="space-y-4">
                {preview.media.posterUrl ? (
                  <img src={preview.media.posterUrl} alt={`${preview.title} poster`} className="mx-auto max-h-[26vh] w-full rounded-2xl object-contain" />
                ) : null}
                <video poster={preview.media.posterUrl} src={preview.media.url} controls playsInline preload="metadata" className="mx-auto max-h-[44vh] w-full rounded-2xl bg-black" />
              </div>
            ) : null}
            {preview.media?.kind === 'audio' ? (
              <div className="flex h-full min-h-[220px] flex-col justify-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-8">
                {preview.media.waveformUrl ? (
                  <img src={preview.media.waveformUrl} alt={`${preview.title} waveform`} className="w-full rounded-2xl border border-white/10 bg-[#04111f]" />
                ) : null}
                <audio src={preview.media.url} controls preload="metadata" className="w-full" />
              </div>
            ) : null}
            {preview.kind === 'pdf' && preview.media?.url ? (
              <iframe src={preview.media.url} title={preview.title} className="h-[72vh] w-full rounded-2xl border border-white/10 bg-white" />
            ) : null}
            {!preview.media && preview.html ? (
              <iframe srcDoc={preview.html} title={preview.title} sandbox="allow-same-origin" className="h-[72vh] w-full rounded-2xl border border-white/10 bg-white" />
            ) : null}
          </div>

          <div className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-[#0b1323] p-4">
            <div className="space-y-4">
              <RepresentationLinks preview={preview} />
              {preview.structuredData ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Structured metadata</div>
                  <pre className="overflow-auto rounded-2xl border border-white/8 bg-black/30 p-3 text-xs text-white/80">{JSON.stringify(preview.structuredData, null, 2)}</pre>
                </div>
              ) : null}
              {preview.inlineText ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Extracted content</div>
                  <pre className="whitespace-pre-wrap rounded-2xl border border-white/8 bg-black/30 p-3 text-xs text-white/80">{preview.inlineText}</pre>
                </div>
              ) : null}
              {preview.html && preview.media ? (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Inspector view</div>
                  <iframe srcDoc={preview.html} title={`${preview.title} inspector`} sandbox="allow-same-origin" className="h-[340px] w-full rounded-2xl border border-white/10 bg-white" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
