import type { StreamsAIScope } from "../auth";
import { buildCanonicalCapabilityAnswer, buildRuntimeCapabilityRegistry } from "../capabilities/canonical-capabilities";
import { StreamsAIMemoryRepository, deriveMemoryKeywords } from "../repositories/memory-repository";

export type StreamsMemoryContext = {
  memories: any[];
  promptBlock: string;
  retrieval: {
    source: "streams-memory";
    query: string;
    memoryCount: number;
    scopes: string[];
    strategy: string[];
  };
};

export type DeterministicFallbackInput = {
  userContent: string;
  memoryContext: StreamsMemoryContext;
  attachmentText?: string;
  hasImageParts?: boolean;
  providerStatus?: "not_configured" | "failed" | "unavailable";
  providerName?: string;
  errorMessage?: string;
};

const memoryRepo = new StreamsAIMemoryRepository();

const MEMORY_TYPES = {
  userPreference: "user_preference",
  businessGoal: "business_goal",
  projectRequirement: "project_requirement",
  technicalConstraint: "technical_constraint",
  correction: "correction",
  workflowPattern: "workflow_pattern",
  fileSummary: "file_summary",
  codebaseFact: "codebase_fact",
  decision: "decision",
  providerIssue: "provider_issue",
  styleRule: "style_rule",
};

function sentence(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value = "", max = 900) {
  const text = sentence(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function safeTitle(value = "") {
  const text = sentence(value);
  if (!text) return "Streams memory";
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function hasSensitiveSignal(text = "") {
  return /\b(password|secret|token|api[_ -]?key|ssn|social security|credit card|bank account|routing number|medical record|diagnosis)\b/i.test(text);
}

function inferMemoryCandidates(userContent: string, assistantContent: string, sessionId: string) {
  const user = sentence(userContent);
  const assistant = sentence(assistantContent);
  const candidates: Array<{ type: string; scope: "user" | "project" | "session" | "system" | "file" | "codebase"; title: string; content: string; confidence: number; importance: number; sensitive?: boolean }> = [];

  if (/\b(i prefer|i like|always|never|don'?t|do not|make sure|remember|from now on|use this style)\b/i.test(user)) {
    candidates.push({ type: MEMORY_TYPES.userPreference, scope: "user", title: "User preference", content: user, confidence: 0.86, importance: 0.8, sensitive: hasSensitiveSignal(user) });
  }

  if (/\b(goal|business|brand|project|app|startup|company|offer|audience|customer|launch|grow|revenue)\b/i.test(user)) {
    candidates.push({ type: MEMORY_TYPES.businessGoal, scope: "project", title: "Project/business context", content: user, confidence: 0.76, importance: 0.72, sensitive: hasSensitiveSignal(user) });
  }

  if (/\b(requirement|must|should|needs to|route|file|repo|branch|commit|vercel|supabase|api|build|deploy|frontend|backend)\b/i.test(user)) {
    candidates.push({ type: MEMORY_TYPES.technicalConstraint, scope: "project", title: "Technical requirement", content: user, confidence: 0.78, importance: 0.76, sensitive: hasSensitiveSignal(user) });
  }

  if (/\b(wrong|incorrect|not what i asked|fix|correct|restore|don'?t claim|do not claim|audit|verify)\b/i.test(user)) {
    candidates.push({ type: MEMORY_TYPES.correction, scope: "user", title: "User correction", content: user, confidence: 0.88, importance: 0.88, sensitive: hasSensitiveSignal(user) });
  }

  if (/\b(provider|openai|claude|anthropic|fallback|memory|rag|retrieval|status|streaming|pacing|error)\b/i.test(user + " " + assistant)) {
    candidates.push({ type: MEMORY_TYPES.workflowPattern, scope: "system", title: "System behavior learning", content: truncate(`User asked: ${user}\nAssistant outcome: ${assistant}`, 1200), confidence: 0.72, importance: 0.66, sensitive: false });
  }

  return candidates.map((candidate) => ({ ...candidate, sessionId }));
}

export async function retrieveStreamsMemoryContext(scope: StreamsAIScope, input: { userContent: string; projectId?: string | null; limit?: number }): Promise<StreamsMemoryContext> {
  const scopes = ["user", "project", "system", "file", "codebase"];
  const memories = await memoryRepo.search(scope, {
    query: input.userContent,
    projectId: input.projectId || null,
    scopes,
    limit: input.limit || 12,
  }).catch(() => []);

  const lines = memories.map((memory: any, index: number) => {
    const label = [memory.scope, memory.memory_type].filter(Boolean).join("/");
    return `${index + 1}. [${label}] ${memory.title || "Memory"}: ${memory.summary || memory.content}`;
  });

  const promptBlock = lines.length
    ? `[Streams retrieved memory]\n${lines.join("\n")}\n[/Streams retrieved memory]\n\nUse these memories only when relevant. Project-scoped memory beats general memory. Recent user corrections beat older inferred preferences.`
    : "";

  return {
    memories,
    promptBlock,
    retrieval: {
      source: "streams-memory",
      query: input.userContent,
      memoryCount: memories.length,
      scopes,
      strategy: ["keyword", "metadata_scope", "project_filter", "recency", "importance", "confidence", "light_rerank"],
    },
  };
}

export async function learnFromStreamsTurn(scope: StreamsAIScope, input: { sessionId: string; projectId?: string | null; userContent: string; assistantContent: string; sourceMessageId?: string | null; provider?: string; providerStatus?: string; metadata?: Record<string, unknown> }) {
  const candidates = inferMemoryCandidates(input.userContent, input.assistantContent, input.sessionId);
  const saved: any[] = [];

  for (const candidate of candidates) {
    if (candidate.sensitive) continue;
    const memory = await memoryRepo.create(scope, {
      projectId: candidate.scope === "project" ? input.projectId || null : null,
      sessionId: input.sessionId,
      sourceMessageId: input.sourceMessageId || null,
      scope: candidate.scope,
      memoryType: candidate.type,
      title: candidate.title,
      content: candidate.content,
      summary: truncate(candidate.content, 320),
      keywords: deriveMemoryKeywords(`${candidate.title} ${candidate.content}`),
      confidenceScore: candidate.confidence,
      importanceScore: candidate.importance,
      isSensitive: false,
      metadata: { ...(input.metadata || {}), provider: input.provider || "unknown", providerStatus: input.providerStatus || "unknown", learnedBy: "streams-memory-engine-v1" },
    }).catch(() => null);
    if (memory?.id) {
      saved.push(memory);
      const chunks = String(candidate.content).match(/[\s\S]{1,1200}/g) || [];
      await Promise.all(chunks.map((chunk, index) => memoryRepo.createChunk(scope, { memoryId: memory.id, projectId: candidate.scope === "project" ? input.projectId || null : null, sourceTable: "streams_ai_chat_messages", sourceId: input.sourceMessageId || null, chunkIndex: index, content: chunk, metadata: { memoryType: candidate.type } }).catch(() => null)));
    }
  }

  return { savedCount: saved.length, saved };
}

export async function recordProviderIssue(scope: StreamsAIScope, input: { sessionId?: string | null; provider: string; model?: string | null; errorMessage: string; userFacingMessage: string }) {
  return memoryRepo.create(scope, {
    sessionId: input.sessionId || null,
    scope: "system",
    memoryType: MEMORY_TYPES.providerIssue,
    title: `${input.provider} provider issue`,
    content: input.errorMessage,
    summary: input.userFacingMessage,
    keywords: deriveMemoryKeywords(`${input.provider} ${input.model || ""} provider failure unavailable`),
    confidenceScore: 1,
    importanceScore: 0.7,
    isUserVisible: false,
    isUserEditable: false,
    metadata: { provider: input.provider, model: input.model || null, recordedBy: "streams-memory-engine-v1" },
  }).catch(() => null);
}

function buildKnownContextAnswer(input: DeterministicFallbackInput) {
  const memoryLines = input.memoryContext.memories.slice(0, 8).map((memory: any, index: number) => `- ${memory.title || `Memory ${index + 1}`}: ${memory.summary || memory.content}`);
  const parts = [
    "I can still work from Streams memory, saved project context, uploaded file context, and system capabilities.",
    memoryLines.length ? `Known context I found:\n${memoryLines.join("\n")}` : "I did not find enough stored memory for this exact request yet.",
  ];
  if (input.attachmentText) parts.push("I also found attached file text/context in this turn and can summarize or extract from that saved context.");
  if (input.hasImageParts) parts.push("An image is attached, but visual understanding requires a vision provider. I can still use the file metadata and any user-supplied description.");
  return parts.join("\n\n");
}

export function buildDeterministicFallbackAnswer(input: DeterministicFallbackInput) {
  const text = input.userContent.toLowerCase();
  const registry = buildRuntimeCapabilityRegistry();

  if (/\b(capabilit|what can streams|what can you do|tools|features)\b/i.test(input.userContent)) {
    return buildCanonicalCapabilityAnswer(input.userContent);
  }

  if (/\b(what were we working on|what did we discuss|what do you remember|remember about|project goal|next steps|requirements|known facts)\b/i.test(input.userContent)) {
    return buildKnownContextAnswer(input);
  }

  if (input.attachmentText && /\b(summarize|summary|extract|key points|what does|review|read)\b/i.test(input.userContent)) {
    const preview = input.attachmentText.replace(/\[Attached file context supplied by Streams backend\]|\[\/Attached file context\]/g, "").trim().slice(0, 2600);
    return `I can answer from the attached file context Streams already extracted.\n\n**Available extracted context**\n${preview}${input.attachmentText.length > 2600 ? "\n\n[Context trimmed for this fallback reply.]" : ""}`;
  }

  if (/\b(plan|checklist|todo|steps|build|fix|audit|implement)\b/i.test(text)) {
    const memory = buildKnownContextAnswer(input);
    return `${memory}\n\n**Deterministic next-step plan**\n1. Confirm the exact target file, route, or project area.\n2. Use saved project memory and uploaded file context first.\n3. Use available tools for repo/file/status checks.\n4. Do not claim provider-level reasoning or image vision until a model provider is available.\n5. Queue provider-needed work as a follow-up once the model provider is restored.`;
  }

  return [
    "I can respond from Streams memory and saved context, but live model reasoning is not available right now.",
    `Streams currently has ${registry.total} registered capability entries and ${input.memoryContext.memories.length} retrieved memory item(s) for this request.`,
    "Ask me about prior project decisions, uploaded files, known requirements, capabilities, or next steps and I can use stored Streams context immediately.",
  ].join("\n\n");
}
