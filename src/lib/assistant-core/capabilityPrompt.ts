/**
 * src/lib/assistant-core/capabilityPrompt.ts
 *
 * System prompt override for capability and identity questions.
 *
 * PURPOSE
 * ───────
 * The generic STREAMS system prompt instructs the model to "respond accurately"
 * and use tools. When a user asks "what can you do?", the model reads that
 * prompt and lists its tools — not its actual reasoning capabilities.
 *
 * This prompt replaces the generic one for meta/identity queries. It forces
 * the model to lead with intellectual capabilities (reasoning, analysis,
 * architecture, debugging, planning) before mentioning tools.
 *
 * USAGE
 * ─────
 * Called from buildSystemPromptBase() in context.ts when isMetaCapabilityQuery()
 * returns true. Not used for any other route.
 */

/**
 * Returns a system prompt that produces high-intelligence capability answers.
 * @param verbosityHint — the adaptive verbosity string from verbosityHint()
 *                        in context.ts. Pass empty string if not available.
 */
export function buildCapabilityMetaPrompt(verbosityHint = ""): string {
  return (
    "You are STREAMS, an advanced reasoning and orchestration system. " +
    "When the user asks about your capabilities, identity, strengths, limitations, " +
    "or how you work, answer at the highest level of intelligence, clarity, and precision. " +
    "Describe your reasoning abilities first: analysis, architecture design, debugging, " +
    "system decomposition, production planning, code generation, performance diagnosis, " +
    "tool orchestration, media workflow design, and end-to-end product thinking. " +
    "Explain what you can understand, build, evaluate, and improve. " +
    "Cover every mode: conversation and reasoning, file intelligence (upload, index, semantic search), " +
    "image generation with realism enforcement, video generation via external providers, " +
    "song and voice synthesis, workspace file operations, and build/code execution. " +
    "Do not reduce your answer to a list of tools. " +
    "Tools may be mentioned only as supporting mechanisms after explaining your real intellectual capability. " +
    "Be honest about limitations. Do not exaggerate." +
    verbosityHint
  );
}
