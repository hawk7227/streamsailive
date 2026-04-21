/**
 * src/lib/assistant-core/context.ts
 *
 * Context assembly for the assistant orchestrator.
 *
 * Responsibilities:
 * - Build the system prompt for the resolved route
 * - Retrieve relevant file chunks when workspaceId is present
 * - Inject file context as a dedicated system prompt section
 *
 * PRD rule: "minimal relevant chunks — never full history dump."
 * File context is retrieved via semantic search on the user's current message,
 * not pre-injected wholesale. Empty result = no injection (no bloat).
 */

import type {
  AssembledAssistantContext,
  BuildContextInput,
  ChatMessage,
} from "./contracts";
import { buildFileContext } from "@/lib/files/retrieval";
import { isMetaCapabilityQuery } from "./metaQuerySignals";
import { buildCapabilityMetaPrompt } from "./capabilityPrompt";

// ── Parallel context deadline ─────────────────────────────────────────────────
// File retrieval races against this deadline before the OpenAI call starts.
// With a warm LRU embedding cache, retrieval resolves in <10ms and always wins.
// On a cold cache miss, embedQuery typically takes 100–350ms. The deadline caps
// that penalty so the orchestrator never blocks longer than this value waiting
// for retrieval before starting the OpenAI stream.
//
// Tuning guide (read TURN_TIMING logs):
//   context_ms < 50ms consistently  → deadline is generous, can tighten
//   context_ms = 150ms often        → cache is cold; check hit rate in logs
//   had_file_ctx: false frequently  → raise deadline or pre-warm cache
const PARALLEL_CONTEXT_DEADLINE_MS = 150;

function sanitizeMessages(messages?: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(
    (message): message is ChatMessage =>
      !!message &&
      (message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant") &&
      typeof message.content === "string",
  );
}

// PRD §3: adaptive verbosity — match response length to query complexity.
// Short factual queries get concise answers. Long or complex queries
// get thorough responses. This preserves OpenAI quality.
function verbosityHint(userText: string): string {
  const len = userText.trim().length;
  if (len < 60)  return " Be concise — match the brevity of the question.";
  if (len > 400) return " Be thorough — this is a detailed or complex request.";
  return "";
}

function buildSystemPromptBase(route: BuildContextInput["route"], userText = ""): string {
  const vhint = verbosityHint(userText);

  // Meta/capability query — override with high-intelligence self-description.
  // Checked before route switch so it takes precedence on any route
  // (e.g. a meta question phrased as a build command still gets answered correctly).
  if (isMetaCapabilityQuery(userText)) {
    return buildCapabilityMetaPrompt(vhint);
  }

  switch (route) {
    case "image":
      return (
        "You are STREAMS. The user has requested image generation. " +
        "Call generate_media immediately with type='image' and the user's exact prompt as-is. " +
        "Do not ask for clarification. Do not ask for more detail. Do not explain what you are about to do. " +
        "Do not summarise the request. Call the tool directly with whatever prompt the user provided. " +
        "If the prompt is short, use it exactly as given." +
        vhint
      );
    case "video":
      return (
        "You are STREAMS. The user has requested video generation. " +
        "Call generate_media immediately with type='video' and the user's exact prompt as-is. " +
        "Do not ask for clarification. Do not ask for more detail. Do not explain what you are about to do. " +
        "Call the tool directly with whatever prompt the user provided." +
        vhint
      );
    case "build":
      return `You are STREAMS. Handle build, code, and repair requests precisely. Use tools when needed. Never pretend filesystem or command execution happened if it did not run.${vhint}`;
    case "file":
      return `You are STREAMS. Handle workspace and file requests precisely. Use tools when needed. Never pretend file operations happened if they did not run.${vhint}`;
    default:
      return `You are STREAMS. Respond like a strong, reliable assistant. Use tools only when needed. Never pretend a tool ran if it did not run.${vhint}`;
  }
}

function appendFileContext(systemPrompt: string, fileContext: string): string {
  if (!fileContext.trim()) return systemPrompt;
  return (
    systemPrompt +
    "\n\n--- Relevant file context (retrieved for this turn only) ---\n" +
    fileContext +
    "\n--- End of file context ---"
  );
}

function appendProjectContext(
  systemPrompt: string,
  projectName: string,
  projectDescription?: string,
): string {
  const desc = projectDescription?.trim();
  const block = desc
    ? `--- Active project: ${projectName} ---\n${desc}\n--- End of project context ---`
    : `--- Active project: ${projectName} ---`;
  return systemPrompt + "\n\n" + block;
}

export async function buildContext(
  input: BuildContextInput,
): Promise<AssembledAssistantContext> {
  const safeMessages = sanitizeMessages(input.messages);
  const safeContext =
    input.context && typeof input.context === "object" ? input.context : {};

  const basePrompt = buildSystemPromptBase(input.route, input.userText);

  // Retrieve file context when workspaceId is present.
  //
  // Races against PARALLEL_CONTEXT_DEADLINE_MS:
  //   - LRU cache hit  → resolves in <10ms, deadline never fires
  //   - Cache miss     → embedQuery + pgvector, typically 120–350ms
  //   - Deadline fires → proceeds without file context (non-fatal)
  //
  // This caps the retrieval latency contribution to the hot path.
  // PRD §4: minimal relevant chunks — empty result = no injection.
  let fileContext = "";
  if (input.workspaceId && input.userText.trim()) {
    try {
      const retrieved = await Promise.race([
        buildFileContext(input.workspaceId, input.userText, 6),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve(""), PARALLEL_CONTEXT_DEADLINE_MS),
        ),
      ]);
      fileContext = retrieved;

      if (!fileContext) {
        console.log(JSON.stringify({
          level: "info",
          event: "FILE_CONTEXT_DEADLINE_FIRED",
          workspaceId: input.workspaceId,
          deadlineMs: PARALLEL_CONTEXT_DEADLINE_MS,
        }));
      }
    } catch (err) {
      // Retrieval failure is non-fatal — assistant continues without file context
      console.error(JSON.stringify({
        level: "error",
        event: "FILE_CONTEXT_RETRIEVAL_FAILED",
        workspaceId: input.workspaceId,
        reason: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  const systemPrompt = appendFileContext(basePrompt, fileContext);

  // Project context — passed by client in buildTurnContext(), no DB call on hot path.
  const projectId =
    input.projectId ??
    (typeof safeContext.projectId === "string" ? safeContext.projectId : undefined);
  const projectName =
    input.projectName ??
    (typeof safeContext.projectName === "string" ? safeContext.projectName : undefined);
  const projectDescription =
    input.projectDescription ??
    (typeof safeContext.projectDescription === "string" ? safeContext.projectDescription : undefined);

  let finalPrompt = systemPrompt;
  if (projectName) {
    finalPrompt = appendProjectContext(systemPrompt, projectName, projectDescription);
  }

  return {
    systemPrompt: finalPrompt,
    route: input.route,
    userText: input.userText,
    messages: safeMessages,
    context: safeContext,
    fileContext: fileContext || undefined,
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    projectId,
    projectName,
  };
}
