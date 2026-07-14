export const STREAMS_PROVIDER_CITATION_RENDERER_VERSION = "streams-provider-citation-renderer-v1";

export type StreamsProviderCitation = {
  url: string;
  title: string;
  startIndex: number | null;
  endIndex: number | null;
};

function safeHttpUrl(value: unknown) {
  const text = String(value || "").trim();
  try {
    const parsed = new URL(text);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function citationPayload(annotation: any) {
  if (!annotation || typeof annotation !== "object") return null;
  const nested = annotation.url_citation && typeof annotation.url_citation === "object" ? annotation.url_citation : annotation;
  const url = safeHttpUrl(nested.url || nested.uri || annotation.url || annotation.uri);
  if (!url) return null;
  const title = String(nested.title || annotation.title || new URL(url).hostname).trim().replace(/[\[\]]/g, "") || new URL(url).hostname;
  const start = Number(nested.start_index ?? annotation.start_index);
  const end = Number(nested.end_index ?? annotation.end_index);
  return {
    url,
    title,
    startIndex: Number.isInteger(start) && start >= 0 ? start : null,
    endIndex: Number.isInteger(end) && end >= 0 ? end : null,
  } satisfies StreamsProviderCitation;
}

export function collectProviderCitations(annotations: unknown[]) {
  const citations: StreamsProviderCitation[] = [];
  const seen = new Set<string>();
  for (const annotation of Array.isArray(annotations) ? annotations : []) {
    const citation = citationPayload(annotation);
    if (!citation || seen.has(citation.url)) continue;
    seen.add(citation.url);
    citations.push(citation);
  }
  return citations;
}

export function renderProviderCitations(text: string, citations: StreamsProviderCitation[]) {
  const source = String(text || "");
  const positioned = citations
    .filter((citation) => citation.endIndex !== null && citation.endIndex <= source.length)
    .sort((left, right) => Number(right.endIndex) - Number(left.endIndex));
  let rendered = source;
  const positionedUrls = new Set<string>();

  for (const citation of positioned) {
    const end = Number(citation.endIndex);
    const marker = ` [${citation.title}](${citation.url})`;
    rendered = `${rendered.slice(0, end)}${marker}${rendered.slice(end)}`;
    positionedUrls.add(citation.url);
  }

  const remaining = citations.filter((citation) => !positionedUrls.has(citation.url));
  if (remaining.length) {
    rendered = `${rendered.trim()}\n\n### Sources\n${remaining.map((citation) => `- [${citation.title}](${citation.url})`).join("\n")}`;
  }

  return {
    content: rendered.trim(),
    citationCount: citations.length,
    citations,
    version: STREAMS_PROVIDER_CITATION_RENDERER_VERSION,
  };
}

export function countVisibleMarkdownCitations(text: string) {
  const urls = new Set<string>();
  for (const match of String(text || "").matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi)) urls.add(match[1]);
  return urls.size;
}
