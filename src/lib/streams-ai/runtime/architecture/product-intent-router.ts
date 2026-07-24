import type { RouteDecision } from "./contracts";

const website = /\b(build|create|make|generate|design|develop)\b[\s\S]{0,80}\b(website|site|landing page|web app|frontend|front-end)\b|\b(website|site|landing page|web app|frontend|front-end)\b[\s\S]{0,80}\b(build|create|make|generate|design|develop)\b/i;
const previewOnly = /\b(only show|show only|frontend view|front-end view|preview only|rendered preview|open (?:the )?preview)\b/i;
const openPreview = /^\s*(?:please\s+)?(?:open|show|launch|view)\s+(?:your\s+|the\s+|my\s+)?preview\s*[.!?]*\s*$/i;
const openWorkspace = /^\s*(?:please\s+)?(?:open|show|go to)\s+(?:the\s+|my\s+)?workspace\s*[.!?]*\s*$/i;
const explainFailure = /^\s*(?:what happened|why did (?:it|that) fail|what went wrong|explain (?:the )?(?:error|failure))\s*[.!?]*\s*$/i;
const retry = /^\s*(?:try|retry|run)\s+(?:it|that|the last (?:step|operation))(?:\s+again)?\s*[.!?]*\s*$|^\s*continue\s*[.!?]*\s*$/i;
const cancel = /^\s*(?:stop|cancel|abort)(?:\s+(?:it|that|the operation|generation))?\s*[.!?]*\s*$/i;

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
