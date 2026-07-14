import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { createStreamsAIServiceClient, streamsAISchema } from "@/lib/streams-ai/server";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";

const MAX_TEXT_BYTES = 8_000_000;
const MAX_PREVIEW_CHARS = 24_000;
const CHUNK_SIZE = 4200;
const CHUNK_OVERLAP = 420;

type ExtractResult = {
  status: "ready" | "metadata_only";
  text: string;
  summary?: string;
  extractionMode: string;
  pageCount?: number;
  visualAnalysis?: string;
  mediaNote?: string;
};

function serviceClient() {
  return createStreamsAIServiceClient();
}

function db() {
  return streamsAISchema(serviceClient());
}

function now() {
  return new Date().toISOString();
}

function cleanText(value: unknown, max = MAX_PREVIEW_CHARS) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[\t\r ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

function mime(asset: Record<string, any>) {
  return String(asset.mime_type || asset.mimeType || "application/octet-stream").toLowerCase();
}

function fileName(asset: Record<string, any>) {
  return String(asset.name || "uploaded-file");
}

function ext(asset: Record<string, any>) {
  const name = fileName(asset).toLowerCase();
  return name.includes(".") ? name.split(".").pop() || "" : "";
}

function isTextLike(asset: Record<string, any>) {
  const type = mime(asset);
  const name = fileName(asset).toLowerCase();
  return type.startsWith("text/")
    || /json|csv|xml|javascript|typescript|css|html|markdown|yaml|x-yaml|sql|rtf/.test(type)
    || /\.(txt|md|csv|json|xml|html|htm|css|js|jsx|ts|tsx|sql|yaml|yml|log|rtf)$/i.test(name);
}

function isPdf(asset: Record<string, any>) { return mime(asset).includes("pdf") || ext(asset) === "pdf"; }
function isDoc(asset: Record<string, any>) { return /wordprocessingml|msword/.test(mime(asset)) || ["docx", "doc"].includes(ext(asset)); }
function isSheet(asset: Record<string, any>) { return /spreadsheet|excel|csv/.test(mime(asset)) || ["csv", "xls", "xlsx"].includes(ext(asset)); }
function isHtml(asset: Record<string, any>) { return /html/.test(mime(asset)) || ["html", "htm"].includes(ext(asset)); }
function isImage(asset: Record<string, any>) { return mime(asset).startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext(asset)); }
function isAudio(asset: Record<string, any>) { return mime(asset).startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "ogg"].includes(ext(asset)); }
function isVideo(asset: Record<string, any>) { return mime(asset).startsWith("video/") || ["mp4", "mov", "webm", "mkv"].includes(ext(asset)); }
function isZipXmlDoc(asset: Record<string, any>) { return ["pptx", "odt", "epub"].includes(ext(asset)); }

function chunkText(text: string) {
  const chunks: string[] = [];
  const value = cleanText(text, MAX_TEXT_BYTES);
  let index = 0;
  while (index < value.length) {
    const next = value.slice(index, index + CHUNK_SIZE);
    if (next.trim()) chunks.push(next);
    index += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.slice(0, 500);
}

function summarize(text: string, asset: Record<string, any>, mode = "text") {
  const clean = cleanText(text, 2600).replace(/\s+/g, " ");
  if (!clean) return `${asset.name || "Uploaded file"} was uploaded and stored. Extraction mode: ${mode}.`;
  return `${asset.name || "Uploaded file"} (${mode}): ${clean.slice(0, 1800)}${clean.length > 1800 ? "…" : ""}`;
}

async function patchAssetMetadata(scope: StreamsAIScope, assetId: string, metadata: Record<string, unknown>) {
  try {
    await db()
      .from("streams_ai_assets")
      .update({ metadata, updated_at: now() })
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", assetId);
  } catch {
    // Metadata updates are supportive; the stored upload remains valid.
  }
}

async function downloadAssetBytes(asset: Record<string, any>) {
  const bucket = asset.storage_bucket || asset.storageBucket;
  const path = asset.storage_path || asset.storagePath;
  if (!bucket || !path) return null;
  const { data, error } = await serviceClient().storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message || "Could not download uploaded asset for processing.");
  if (data.size > MAX_TEXT_BYTES) throw new Error(`File is too large for inline extraction (${data.size} bytes).`);
  return Buffer.from(await data.arrayBuffer());
}

function extractHtml(buffer: Buffer) {
  const $ = cheerio.load(buffer.toString("utf8"));
  $("script,style,noscript,svg").remove();
  return cleanText($("body").text() || $.root().text(), MAX_TEXT_BYTES);
}

function extractRtf(buffer: Buffer) {
  return buffer.toString("utf8")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function countPdfPagesFallback(buffer: Buffer) {
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

function extractPdfFallbackText(buffer: Buffer) {
  const literalStrings = Array.from(buffer.toString("latin1").matchAll(/\(([^()]{3,500})\)/g)).map((match) => match[1]);
  return cleanText(literalStrings.join(" "), MAX_TEXT_BYTES);
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  let text = "";
  let pageCount = countPdfPagesFallback(buffer);
  try {
    const pdfModule: any = await import("pdf-parse");
    if (pdfModule?.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const result = await parser.getText();
      text = cleanText(result?.text || "", MAX_TEXT_BYTES);
      pageCount = Number(result?.total || result?.numpages || result?.numPages || pageCount || 0);
      await parser.destroy?.();
    }
  } catch {
    // Use fallback extraction below.
  }
  if (!text) text = extractPdfFallbackText(buffer);
  const visualAnalysis = pageCount > 1000
    ? "PDF is over 1000 pages; process as text only."
    : pageCount > 100
      ? "PDF is over 100 pages; text extraction is available but visual analysis is limited."
      : "PDF is under 100 pages; text and visual review can be requested.";
  return { status: text ? "ready" : "metadata_only", text, extractionMode: "pdf", pageCount, visualAnalysis };
}

async function extractDoc(buffer: Buffer, asset: Record<string, any>): Promise<ExtractResult> {
  if (ext(asset) === "doc") {
    return { status: "metadata_only", text: "", extractionMode: "legacy-doc", mediaNote: "Legacy .doc stored; convert to .docx for full extraction." };
  }
  const result = await mammoth.extractRawText({ buffer });
  const text = cleanText(result.value, MAX_TEXT_BYTES);
  return { status: text ? "ready" : "metadata_only", text, extractionMode: "docx" };
}

function extractSheet(buffer: Buffer, asset: Record<string, any>): ExtractResult {
  if (ext(asset) === "csv" || mime(asset).includes("csv")) {
    return { status: "ready", text: cleanText(buffer.toString("utf8"), MAX_TEXT_BYTES), extractionMode: "csv" };
  }
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, 12)) {
    const sheet = workbook.Sheets[sheetName];
    parts.push(`Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet).slice(0, 18000)}`);
  }
  const text = cleanText(parts.join("\n\n---\n\n"), MAX_TEXT_BYTES);
  return { status: text ? "ready" : "metadata_only", text, extractionMode: "spreadsheet" };
}

function xmlText(value: string) {
  return value.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractZipXml(buffer: Buffer, asset: Record<string, any>): ExtractResult {
  const zip = new AdmZip(buffer);
  const extension = ext(asset);
  const texts: string[] = [];
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.toLowerCase();
    if (entry.isDirectory) continue;
    const include = extension === "pptx"
      ? /ppt\/slides\/slide\d+\.xml$/.test(name)
      : extension === "odt"
        ? name === "content.xml"
        : extension === "epub"
          ? /\.(xhtml|html|htm|xml)$/.test(name) && !/container|opf|toc/.test(name)
          : false;
    if (!include) continue;
    texts.push(xmlText(entry.getData().toString("utf8")));
    if (texts.join("\n").length > MAX_TEXT_BYTES) break;
  }
  const label = extension === "pptx" ? "presentation" : extension === "odt" ? "odt-document" : "epub";
  const text = cleanText(texts.join("\n\n---\n\n"), MAX_TEXT_BYTES);
  return { status: text ? "ready" : "metadata_only", text, extractionMode: label };
}

async function extractAsset(asset: Record<string, any>): Promise<ExtractResult> {
  if (isImage(asset)) return { status: "metadata_only", text: "", extractionMode: "image", mediaNote: "Image stored for direct vision review." };
  if (isAudio(asset)) return { status: "metadata_only", text: "", extractionMode: "audio", mediaNote: "Audio stored; transcript extraction is not enabled in this processor." };
  if (isVideo(asset)) return { status: "metadata_only", text: "", extractionMode: "video", mediaNote: "Video stored; frame and transcript extraction are not enabled in this processor." };
  const bytes = await downloadAssetBytes(asset);
  if (!bytes) return { status: "metadata_only", text: "", extractionMode: "missing-bytes" };
  if (isPdf(asset)) return extractPdf(bytes);
  if (isDoc(asset)) return extractDoc(bytes, asset);
  if (isSheet(asset)) return extractSheet(bytes, asset);
  if (isHtml(asset)) return { status: "ready", text: extractHtml(bytes), extractionMode: "html" };
  if (ext(asset) === "rtf" || mime(asset).includes("rtf")) return { status: "ready", text: cleanText(extractRtf(bytes), MAX_TEXT_BYTES), extractionMode: "rtf" };
  if (isZipXmlDoc(asset)) return extractZipXml(bytes, asset);
  if (isTextLike(asset)) return { status: "ready", text: cleanText(bytes.toString("utf8"), MAX_TEXT_BYTES), extractionMode: "text" };
  return { status: "metadata_only", text: "", extractionMode: "unsupported", mediaNote: "Stored as an attachment; no parser is available for this file type." };
}

async function persistChunksBestEffort(scope: StreamsAIScope, asset: Record<string, any>, chunks: string[], summary: string, extractionMode: string) {
  if (!chunks.length) return { indexed: false, error: "" };
  try {
    const table = db().from("streams_ai_asset_chunks");
    const { error: deleteError } = await table.delete().eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("asset_id", asset.id);
    if (deleteError) throw deleteError;
    const rows = chunks.map((chunk, index) => ({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      project_id: asset.project_id || scope.defaultProjectId || null,
      session_id: asset.session_id || null,
      asset_id: asset.id,
      chunk_index: index,
      content: chunk,
      summary: index === 0 ? summary : null,
      token_estimate: Math.ceil(chunk.length / 4),
      metadata: { source: "streams-ai-asset-processing", assetName: asset.name || "Uploaded file", mimeType: mime(asset), extractionMode },
      created_at: now(),
    }));
    const { error: insertError } = await db().from("streams_ai_asset_chunks").insert(rows);
    if (insertError) throw insertError;
    return { indexed: true, error: "" };
  } catch (error) {
    return { indexed: false, error: error instanceof Error ? error.message : String(error || "Chunk indexing unavailable") };
  }
}

export async function processUploadedAsset(scope: StreamsAIScope, asset: Record<string, any>) {
  const assetId = String(asset.id || "");
  if (!assetId) return { ok: false, status: "failed", error: "asset id missing" };
  const baseMetadata = { ...(asset.metadata || {}), processingStatus: "queued", processingQueuedAt: now() };
  await patchAssetMetadata(scope, assetId, baseMetadata);

  try {
    await patchAssetMetadata(scope, assetId, { ...baseMetadata, processingStatus: "processing", extractionStatus: "extracting", processingStartedAt: now() });
    const extracted = await extractAsset(asset);
    const text = extracted.text || "";
    const chunks = text ? chunkText(text) : [];
    const summary = extracted.summary || summarize(text, asset, extracted.extractionMode);
    const indexing = await persistChunksBestEffort(scope, asset, chunks, summary, extracted.extractionMode);

    const metadata = {
      ...baseMetadata,
      processingStatus: "ready",
      extractionStatus: extracted.status,
      extractionMode: extracted.extractionMode,
      processedAt: now(),
      chunkCount: chunks.length,
      indexingStatus: indexing.indexed ? "ready" : chunks.length ? "deferred" : "not_required",
      indexingError: indexing.error || null,
      textPreview: cleanText(text, 6000),
      summary,
      pageCount: extracted.pageCount || null,
      visualAnalysis: extracted.visualAnalysis || null,
      mediaNote: extracted.mediaNote || null,
    };
    await patchAssetMetadata(scope, assetId, metadata);
    return {
      ok: true,
      status: extracted.status,
      stored: true,
      indexed: indexing.indexed,
      indexingStatus: metadata.indexingStatus,
      indexingError: metadata.indexingError,
      chunkCount: chunks.length,
      summary,
      textPreview: metadata.textPreview,
      extractionMode: extracted.extractionMode,
      pageCount: extracted.pageCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "Asset processing failed");
    await patchAssetMetadata(scope, assetId, {
      ...baseMetadata,
      processingStatus: "stored",
      extractionStatus: "failed",
      processingError: message,
      processedAt: now(),
    });
    return { ok: true, status: "metadata_only", stored: true, indexed: false, processingError: message, error: message };
  }
}

export async function processUploadedAssets(scope: StreamsAIScope, assets: Record<string, any>[]) {
  const results = [];
  for (const asset of assets) results.push(await processUploadedAsset(scope, asset));
  return results;
}

export async function retrieveAssetContext(scope: StreamsAIScope, sessionId: string, query: string, options: { limit?: number } = {}) {
  const limit = Math.max(1, Math.min(12, options.limit || 8));
  const terms = cleanText(query, 400).toLowerCase().split(/\W+/).filter((term) => term.length > 2).slice(0, 24);
  try {
    const { data, error } = await db()
      .from("streams_ai_asset_chunks")
      .select("asset_id, chunk_index, content, summary, metadata, created_at")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const ranked = (data || [])
      .map((row) => {
        const haystack = `${row.content || ""} ${row.summary || ""}`.toLowerCase();
        const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
        return { ...row, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return { ok: true, chunks: ranked };
  } catch {
    return { ok: false, chunks: [] as Record<string, unknown>[] };
  }
}

export function formatAssetContextForPrompt(chunks: Record<string, any>[]) {
  if (!chunks.length) return "";
  return [
    "Uploaded file context retrieved for this chat:",
    ...chunks.map((chunk, index) => {
      const meta = chunk.metadata || {};
      return `File chunk ${index + 1}: ${meta.assetName || chunk.asset_id || "uploaded file"} · chunk ${chunk.chunk_index}\n${String(chunk.content || "").slice(0, 5000)}`;
    }),
  ].join("\n\n---\n\n");
}
