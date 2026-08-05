import type { RuntimeOperation } from "./contracts";

const EXECUTION_CLAIMS = /\b(?:I have|I've|has been|is now)\s+(?:built|created|saved|deployed|opened|generated|completed)|\b(?:preview|build|project|files?)\s+(?:is|are)\s+(?:ready|complete|saved|available)\b/i;

export function assertExecutionClaimsGrounded(content: string, operation?: RuntimeOperation | null) {
  if (!EXECUTION_CLAIMS.test(String(content || ""))) return;
  const complete = operation?.status === "completed" && operation.stage === "COMPLETED";
  const hasProof = Boolean(operation?.artifacts?.length && (operation.previewId || operation.previewUrl));
  if (!complete || !hasProof) throw new Error("STREAMS_UNGROUNDED_EXECUTION_CLAIM");
}

/**
 * Human-readable completion message for a finished runtime operation.
 *
 * The raw preview URL is deliberately NOT included. The UI receives the
 * preview separately through the `artifact` event (action: "open_preview")
 * and mounts it in the preview pane, so repeating the path as chat text was
 * redundant and made the assistant read like a status line rather than a
 * collaborator.
 *
 * Any wording that claims execution ("is ready", "has been built") is still
 * gated by assertExecutionClaimsGrounded — this function is only reached on a
 * completed operation with artifacts, so those claims are grounded.
 */
function describeArtifacts(operation: RuntimeOperation) {
  const kinds = new Set((operation.artifacts || []).map((artifact) => artifact.artifactType));
  const parts: string[] = [];
  if (kinds.has("source")) parts.push("the HTML source");
  if (kinds.has("preview")) parts.push("a live preview");
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function requestSummary(operation: RuntimeOperation) {
  const raw = String((operation.metadata as Record<string, unknown> | undefined)?.userMessage || "").trim();
  if (!raw) return "";
  const firstLine = raw.split("\n")[0].trim();
  if (!firstLine || firstLine.length > 120) return "";
  return firstLine.replace(/[.!?]+$/, "");
}

export function runtimeCompletionMessage(operation: RuntimeOperation) {
  if (operation.status === "failed" && operation.failure) return operation.failure.safeMessage;

  if (operation.intent === "CREATE_WEBSITE" && operation.previewUrl) {
    const summary = requestSummary(operation);
    const built = describeArtifacts(operation);
    const opening = summary
      ? `Built the page you asked for — ${summary.toLowerCase()}.`
      : "Built the page you asked for.";
    const detail = built ? ` I generated ${built}, and it's open in the preview pane.` : " It's open in the preview pane.";
    return `${opening}${detail} Tell me what to change and I'll edit it directly.`;
  }

  if (operation.intent === "OPEN_PREVIEW" && operation.previewUrl) {
    return "Opened your most recent preview in the preview pane.";
  }

  return "That's done.";
}

