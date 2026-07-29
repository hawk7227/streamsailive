import type { RouteDecision } from "./contracts";

const website = /\b(build|create|make|generate|design|develop)\b[\s\S]{0,80}\b(website|site|landing page|web app|frontend|front-end)\b|\b(website|site|landing page|web app|frontend|front-end)\b[\s\S]{0,80}\b(build|create|make|generate|design|develop)\b/i;
const previewOnly = /\b(only show|show only|frontend view|front-end view|preview only|rendered preview|open (?:the )?preview)\b/i;
const openPreview = /^\s*(?:please\s+)?(?:open|show|launch|view)\s+(?:your\s+|the\s+|my\s+)?preview\s*[.!?]*\s*$/i;
const openWorkspace = /^\s*(?:please\s+)?(?:open|show|go to)\s+(?:the\s+|my\s+)?workspace\s*[.!?]*\s*$/i;
const explainFailure = /^\s*(?:what happened|why did (?:it|that) fail|what went wrong|explain (?:the )?(?:error|failure))\s*[.!?]*\s*$/i;
const retry = /^\s*(?:try|retry|run)\s+(?:it|that|the last (?:step|operation))(?:\s+again)?\s*[.!?]*\s*$|^\s*continue\s*[.!?]*\s*$/i;
const cancel = /^\s*(?:stop|cancel|abort)(?:\s+(?:it|that|the operation|generation))?\s*[.!?]*\s*$/i;
const visualEditorRequest = /\b(?:edit visually|visual edit|visual editor|click and (?:change|edit)|select (?:an |the )?element|edit (?:the )?(?:text|image|spacing|style|layout|component)|let me edit|put (?:it|this|that) in (?:the )?editor|show (?:it|this|that) in (?:the )?visual editor)\b/i;
const centerPreviewRequest = /\b(?:open|show|view|launch|preview|review|render)\b[\s\S]{0,48}\b(?:preview|page|frontend|front-end|website|site|result|artifact|browser|build)\b|\b(?:open|show|view|launch)\s+(?:the\s+|my\s+|this\s+|that\s+|current\s+)?(?:preview|page|frontend|website|site|result|artifact|browser)\b/i;
const contextualPreviewRequest = /^\s*(?:please\s+)?(?:open|show|view|preview|let me see)\s+(?:it|that|this|the result)\s*[.!?]*\s*$/i;

export type PreviewSurfaceIntent = {
  surface: "center-preview" | "visual-editor";
  mode: "browser" | "editor";
  immediate: true;
  reason: "visual-edit-intent" | "preview-intent" | "contextual-preview-intent";
  externalUrl?: string;
};

function externalHttpUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>'"`]+/i)?.[0]?.replace(/[.,;:!?]+$/g, "");
  if (!match) return "";
  try { const url = new URL(match); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : ""; } catch { return ""; }
}

export function routePreviewSurfaceIntent(
  message: string,
  context: { hasActivePreview?: boolean; hasEditableSource?: boolean; currentSurface?: PreviewSurfaceIntent["surface"] | null } = {},
): PreviewSurfaceIntent | null {
  const text = String(message || "").trim();
  if (!text) return null;
  if (visualEditorRequest.test(text)) {
    const externalUrl = externalHttpUrl(text);
    return { surface: "visual-editor", mode: externalUrl ? "browser" : "editor", immediate: true, reason: "visual-edit-intent", ...(externalUrl ? { externalUrl } : {}) };
  }
  if (centerPreviewRequest.test(text)) {
    return { surface: "center-preview", mode: "browser", immediate: true, reason: "preview-intent" };
  }
  if (context.hasActivePreview && contextualPreviewRequest.test(text)) {
    return { surface: "center-preview", mode: "browser", immediate: true, reason: "contextual-preview-intent" };
  }
  return null;
}

export function routeProductIntent(message: string, context?: { hasFailedOperation?: boolean; hasActivePreview?: boolean }): RouteDecision {
  const text = String(message || "").trim();
  if (openPreview.test(text)) return { intent: "OPEN_PREVIEW", confidence: 1, deterministic: true, requiresBuilder: false, requiresCurrentInformation: false, requestedOutput: "PREVIEW_ONLY", referent: "active_preview", signals: ["direct-preview-command"] };
  if (openWorkspace.test(text)) return { intent: "OPEN_WORKSPACE", confidence: 1, deterministic: true, requiresBuilder: false, requiresCurrentInformation: false, requestedOutput: "CHAT_ONLY", referent: "active_workspace", signals: ["direct-workspace-command"] };
  if (explainFailure.test(text)) return { intent: "EXPLAIN_FAILURE", confidence: 1, deterministic: true, requiresBuilder: false, requiresCurrentInformation: false, requestedOutput: "CHAT_ONLY", referent: "last_operation", signals: ["failure-reference"] };
  if (retry.test(text)) return { intent: "RETRY_LAST_OPERATION", confidence: .98, deterministic: true, requiresBuilder: true, requiresCurrentInformation: false, requestedOutput: "PREVIEW_ONLY", referent: "last_operation", signals: ["retry-reference"] };
  if (cancel.test(text)) return { intent: "CANCEL_OPERATION", confidence: .99, deterministic: true, requiresBuilder: false, requiresCurrentInformation: false, requestedOutput: "CHAT_ONLY", referent: "last_operation", signals: ["cancel-command"] };
  if (website.test(text)) return { intent: "CREATE_WEBSITE", confidence: .98, deterministic: true, requiresBuilder: true, requiresCurrentInformation: false, requestedOutput: previewOnly.test(text) ? "PREVIEW_ONLY" : "CODE_AND_PREVIEW", referent: null, signals: ["website-build-intent", ...(previewOnly.test(text) ? ["preview-only"] : [])] };
  return { intent: "GENERAL_CHAT", confidence: .7, deterministic: false, requiresBuilder: false, requiresCurrentInformation: false, requestedOutput: "CHAT_ONLY", referent: null, signals: [] };
}

export function isRuntimeActionIntent(decision: RouteDecision) {
  return decision.intent !== "GENERAL_CHAT";
}
