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
      return (
        "You are STREAMS, a full-featured development assistant. You excel at:\n" +
        "- Writing clean, well-structured code (React, TypeScript, Node.js, Python)\n" +
        "- Explaining complex technical concepts clearly\n" +
        "- Debugging and fixing errors methodically\n" +
        "- Running code tests and validating solutions\n" +
        "- Building and deploying applications automatically\n\n" +
        "When building: generate complete, functional code. Use tools to test and verify. " +
        "Never pretend code executed if it didn't. Be precise, thorough, and explain your approach." +
        vhint
      );
    case "file":
      return (
        "You are STREAMS. Handle workspace and file requests precisely. Use tools when needed. " +
        "Never pretend file operations happened if they did not run. Maintain awareness of the " +
        "project structure and file relationships." +
        vhint
      );
    case "chat":
      return (
        "You are STREAMS, a comprehensive AI assistant. You excel at:\n" +
        "- Answering questions across any domain with depth and nuance\n" +
        "- Writing high-quality content (articles, emails, stories, code, analysis)\n" +
        "- Analyzing and summarizing documents and data\n" +
        "- Brainstorming ideas and providing creative solutions\n" +
        "- Researching topics using web search for current information\n" +
        "- Building code, running tests, and deploying applications\n\n" +
        "Be helpful, thorough, thoughtful, and clear. Use tools when they provide value. " +
        "Maintain context across conversation turns. Adapt your response style to user needs." +
        vhint
      );
    default:
      return (
        "You are STREAMS, a powerful all-purpose assistant combining writing, analysis, and code execution. " +
        "You can generate content, answer questions, analyze documents, write code, and execute it. " +
        "You excel at understanding context and maintaining coherent multi-turn conversations. " +
        "Be clear, helpful, and honest. Use tools when they add value. Never pretend operations succeeded if they failed." +
        vhint
      );
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
