import path from 'node:path';
import type { ParseResult } from '@/lib/files/parser';
import type { FileClassification } from '@/lib/files/fileClassifier';

export type FilePreviewKind =
  | 'text'
  | 'code'
  | 'json'
  | 'csv'
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'archive'
  | 'image'
  | 'video'
  | 'audio'
  | 'binary';

export interface FilePreviewManifest {
  kind: FilePreviewKind;
  title: string;
  mimeType: string;
  fileName: string;
  sourceUrl: string;
  downloadUrl: string;
  inlineText?: string;
  html?: string;
  codeLanguage?: string;
  structuredData?: Record<string, unknown>;
  media?: {
    kind: 'image' | 'video' | 'audio' | 'document';
    url: string;
    posterUrl?: string;
    waveformUrl?: string;
  };
  representations?: Array<{
    kind: 'native' | 'poster' | 'waveform' | 'download';
    label: string;
    url: string;
    mimeType?: string;
  }>;
}

interface BuildPreviewArgs {
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  parsed: ParseResult;
  classification: FileClassification;
  fileId?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extOf(fileName: string): string {
  return path.extname(fileName).replace(/^\./, '').toLowerCase();
}

function renderDocumentShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0b1020; color: #e5e7eb; }
  .wrap { padding: 20px; }
  .card { background: rgba(15,23,42,.88); border: 1px solid rgba(148,163,184,.18); border-radius: 16px; padding: 18px; box-shadow: 0 10px 24px rgba(0,0,0,.22); }
  .title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
  .meta { color: #94a3b8; font-size: 12px; margin-bottom: 16px; }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; background: rgba(2,6,23,.8); border: 1px solid rgba(148,163,184,.12); border-radius: 12px; padding: 14px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid rgba(148,163,184,.16); padding: 8px; text-align: left; vertical-align: top; }
  th { color: #cbd5e1; background: rgba(30,41,59,.85); }
  .badge { display: inline-block; padding: 4px 8px; font-size: 11px; border-radius: 999px; background: rgba(59,130,246,.15); border: 1px solid rgba(96,165,250,.28); color: #bfdbfe; }
  .muted { color: #94a3b8; }
  .stack { display: grid; gap: 14px; }
  .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .metric { border: 1px solid rgba(148,163,184,.12); border-radius: 12px; padding: 12px; background: rgba(2,6,23,.55); }
  .metric-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
  .metric-value { font-size: 13px; color: #f8fafc; overflow-wrap: anywhere; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

function buildMetricGrid(structuredData?: Record<string, unknown>): string {
  if (!structuredData) return '';
  const entries = Object.entries(structuredData)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 18);
  if (!entries.length) return '';
  return `<div class="grid">${entries.map(([key, value]) => `
    <div class="metric">
      <div class="metric-label">${escapeHtml(key)}</div>
      <div class="metric-value">${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value))}</div>
    </div>
  `).join('')}</div>`;
}

function buildTextHtml(title: string, text: string, metaLine: string): string {
  return renderDocumentShell(title, `
    <h1 class="title">${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(metaLine)}</div>
    <pre>${escapeHtml(text || 'No extracted text available.')}</pre>
  `);
}

function buildCodeHtml(title: string, text: string, language: string): string {
  return renderDocumentShell(title, `
    <div class="badge">${escapeHtml(language.toUpperCase())}</div>
    <h1 class="title" style="margin-top: 10px;">${escapeHtml(title)}</h1>
    <pre><code>${escapeHtml(text || '// No extracted code available.')}</code></pre>
  `);
}

function buildCsvHtml(title: string, text: string, structuredData: Record<string, unknown>): string {
  const rows = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 25);
  const parsedRows = rows.map((row) => row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
  const header = parsedRows[0] ?? [];
  const bodyRows = parsedRows.slice(1);
  const headerHtml = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  const bodyHtml = bodyRows.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="meta">Previewing first ${bodyRows.length} rows</div>
      </div>
      ${buildMetricGrid(structuredData)}
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml || '<tr><td class="muted" colspan="100%">No rows available.</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

function buildArchiveHtml(title: string, metadata: Record<string, unknown>, text: string): string {
  const files = Array.isArray(metadata.files) ? metadata.files as Array<Record<string, unknown>> : [];
  const rows = files.slice(0, 80).map((entry) => `
    <tr>
      <td>${escapeHtml(String(entry.name ?? ''))}</td>
      <td>${escapeHtml(String(entry.size ?? ''))}</td>
      <td>${escapeHtml(String(entry.isDir ?? false))}</td>
    </tr>`).join('');

  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="meta">Archive preview</div>
      </div>
      ${buildMetricGrid(metadata)}
      <table>
        <thead><tr><th>Name</th><th>Size</th><th>Directory</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No archive entries found.</td></tr>'}</tbody>
      </table>
      <pre>${escapeHtml(text || 'No extracted inner file text available.')}</pre>
    </div>
  `);
}

function buildSlidesHtml(title: string, text: string, metadata: Record<string, unknown>): string {
  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="meta">Slide preview</div>
      </div>
      ${buildMetricGrid(metadata)}
      <pre>${escapeHtml(text || 'No slide text available.')}</pre>
    </div>
  `);
}

function buildSpreadsheetHtml(title: string, text: string, metadata: Record<string, unknown>): string {
  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="meta">Spreadsheet preview</div>
      </div>
      ${buildMetricGrid(metadata)}
      <pre>${escapeHtml(text || 'No sheet data available.')}</pre>
    </div>
  `);
}

function buildPdfHtml(title: string, text: string, metadata: Record<string, unknown>): string {
  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <div class="meta">PDF extracted preview</div>
      </div>
      ${buildMetricGrid(metadata)}
      <pre>${escapeHtml(text || 'No PDF text available.')}</pre>
    </div>
  `);
}

function buildMediaHtml(title: string, kind: 'video' | 'audio' | 'image', text: string, metadata: Record<string, unknown>): string {
  return renderDocumentShell(title, `
    <div class="stack">
      <div>
        <div class="badge">${escapeHtml(kind.toUpperCase())}</div>
        <h1 class="title" style="margin-top: 10px;">${escapeHtml(title)}</h1>
        <div class="meta">Structured media preview</div>
      </div>
      ${buildMetricGrid(metadata)}
      <pre>${escapeHtml(text || `No ${kind} summary available.`)}</pre>
    </div>
  `);
}

function buildFileAssetUrl(fileId: string | undefined, assetKind: 'poster' | 'waveform'): string | undefined {
  if (!fileId) return undefined;
  return `/api/files/${fileId}/asset/${assetKind}`;
}

function buildRepresentations(manifest: FilePreviewManifest): NonNullable<FilePreviewManifest['representations']> {
  const representations: NonNullable<FilePreviewManifest['representations']> = [
    { kind: 'download', label: 'Download original', url: manifest.downloadUrl, mimeType: manifest.mimeType },
  ];

  if (manifest.media?.url) {
    representations.unshift({ kind: 'native', label: 'Open native preview', url: manifest.media.url, mimeType: manifest.mimeType });
  }
  if (manifest.media?.posterUrl) {
    representations.push({ kind: 'poster', label: 'Poster frame', url: manifest.media.posterUrl, mimeType: 'image/jpeg' });
  }
  if (manifest.media?.waveformUrl) {
    representations.push({ kind: 'waveform', label: 'Waveform', url: manifest.media.waveformUrl, mimeType: 'image/png' });
  }
  return representations;
}

export function buildFilePreviewManifest(args: BuildPreviewArgs): FilePreviewManifest {
  const kind = args.classification.kind;
  const safeText = args.parsed.text?.slice(0, 100000) ?? '';
  const mimeType = args.mimeType || 'application/octet-stream';
  const title = args.fileName;
  const extension = extOf(args.fileName);

  const baseManifest = {
    title,
    fileName: args.fileName,
    mimeType,
    sourceUrl: args.sourceUrl,
    downloadUrl: args.sourceUrl,
    inlineText: safeText,
    structuredData: args.parsed.metadata,
  };

  if (kind === 'image') {
    const manifest: FilePreviewManifest = {
      kind: 'image',
      ...baseManifest,
      media: { kind: 'image', url: args.sourceUrl },
      html: buildMediaHtml(title, 'image', safeText, args.parsed.metadata),
    };
    manifest.representations = buildRepresentations(manifest);
    return manifest;
  }

  if (kind === 'video') {
    const manifest: FilePreviewManifest = {
      kind: 'video',
      ...baseManifest,
      media: { kind: 'video', url: args.sourceUrl, posterUrl: buildFileAssetUrl(args.fileId, 'poster') },
      html: buildMediaHtml(title, 'video', safeText, args.parsed.metadata),
    };
    manifest.representations = buildRepresentations(manifest);
    return manifest;
  }

  if (kind === 'audio') {
    const manifest: FilePreviewManifest = {
      kind: 'audio',
      ...baseManifest,
      media: { kind: 'audio', url: args.sourceUrl, waveformUrl: buildFileAssetUrl(args.fileId, 'waveform') },
      html: buildMediaHtml(title, 'audio', safeText, args.parsed.metadata),
    };
    manifest.representations = buildRepresentations(manifest);
    return manifest;
  }

  if (kind === 'pdf') {
    const manifest: FilePreviewManifest = {
      kind: 'pdf',
      ...baseManifest,
      media: { kind: 'document', url: args.sourceUrl },
      html: buildPdfHtml(title, safeText, args.parsed.metadata),
    };
    manifest.representations = buildRepresentations(manifest);
    return manifest;
  }

  if (kind === 'docx') {
    return {
      kind: 'docx',
      ...baseManifest,
      html: buildTextHtml(title, safeText, 'Document preview'),
    };
  }

  if (kind === 'xlsx') {
    return {
      kind: 'xlsx',
      ...baseManifest,
      html: buildSpreadsheetHtml(title, safeText, args.parsed.metadata),
    };
  }

  if (kind === 'pptx') {
    return {
      kind: 'pptx',
      ...baseManifest,
      html: buildSlidesHtml(title, safeText, args.parsed.metadata),
    };
  }

  if (kind === 'csv') {
    return {
      kind: 'csv',
      ...baseManifest,
      html: buildCsvHtml(title, safeText, args.parsed.metadata),
    };
  }

  if (kind === 'json') {
    return {
      kind: 'json',
      ...baseManifest,
      html: buildCodeHtml(title, safeText, 'json'),
      codeLanguage: 'json',
    };
  }

  if (kind === 'archive') {
    return {
      kind: 'archive',
      ...baseManifest,
      html: buildArchiveHtml(title, args.parsed.metadata, safeText),
    };
  }

  if (kind === 'code') {
    return {
      kind: 'code',
      ...baseManifest,
      html: buildCodeHtml(title, safeText, extension || 'text'),
      codeLanguage: extension || 'text',
    };
  }

  if (kind === 'text') {
    return {
      kind: 'text',
      ...baseManifest,
      html: buildTextHtml(title, safeText, 'Text preview'),
    };
  }

  return {
    kind: 'binary',
    ...baseManifest,
    html: buildTextHtml(title, safeText || 'Binary file uploaded. Structured inspection is not available for this file type yet.', 'Binary preview'),
  };
}
