# Streams Source-Backed Knowledge Research Log

Status: foundation research log, not final world-maximum claim.

Purpose: keep the existing chat capability registry, then add source-backed expert knowledge packs over time. This file records the external sources that support each knowledge pack so the assistant is not limited to only previous conversations or saved project memory.

## Current source baseline

### AI agents / tools / orchestration

- OpenAI Agents SDK / API docs: https://platform.openai.com/docs/guides/agents
  - Supports source-backed standards for: agent definitions, tools, MCP/connectors, retrieval/file search, shell/computer use, background mode, streaming, webhooks, prompt caching, evals, guardrails, deployment checklist, and Codex workflows.
  - Streams implication: chat must separate tool readiness from knowledge-only guidance, use retrieval/context management, preserve proof, and use eval/trace style workflows before claiming reliability.

- Anthropic Claude tool use docs: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
  - Supports source-backed standards for: tool definition, tool choice, tool results, and explicit model/tool orchestration.
  - Streams implication: tool calls must have precise schemas, execution results must be returned to the model, and missing tools must be treated as blocked rather than guessed.

- Model Context Protocol overview: https://modelcontextprotocol.io/
  - Supports source-backed standards for: external tool/data connectors, client/server separation, resources, prompts, tools, and transport boundaries.
  - Streams implication: retrieval and routing should be connector-aware, source-aware, permission-aware, and not dependent only on chat history.

### AI coding / repository agents

- GitHub Copilot coding agent docs: https://docs.github.com/en/copilot/concepts/about-copilot-coding-agent
  - Supports source-backed standards for: agent task assignment, repository context, isolated execution environment, pull requests, review, and human approval.
  - Streams implication: Builder must work from repo truth, produce diffs/PR-like proof, use review gates, and never claim a fix without build/browser proof.

- OpenAI Codex docs: https://developers.openai.com/codex
  - Supports source-backed standards for: coding agent workflows, environments, review, sandboxing, worktrees, commands, AGENTS.md/rules, MCP, approvals, automation, and troubleshooting.
  - Streams implication: Builder should use workspaces, source truth, repair loops, browser proof, and explicit approval for destructive operations.

### App/tool calling platform patterns

- Vercel AI SDK tool-calling docs: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
  - Supports source-backed standards for: tool schemas, model tool selection, execution, multi-step tool calls, and typed tool results.
  - Streams implication: chat should route through typed tool contracts and return structured status/proof rather than free-form fake execution.

- Supabase docs: https://supabase.com/docs
  - Supports source-backed standards for: Postgres database, Auth, Storage, Realtime, Edge Functions, queues, cron, REST/GraphQL APIs, CLI, and troubleshooting.
  - Streams implication: project/job/asset state, uploads, proof records, and readiness checks should use Supabase-backed state and service-role boundaries.

- Playwright docs: https://playwright.dev/docs/intro
  - Supports source-backed standards for: cross-browser end-to-end testing, headless/headed runs, traces, reports, retries, browser projects, and CI.
  - Streams implication: browser verification should check real routes, mobile/desktop behavior, screenshots/traces, and not rely on visual guessing.

### Design/frontend systems

- Figma Dev Mode: https://www.figma.com/dev-mode/
  - Supports source-backed standards for: design-to-code handoff, inspect mode, variables/tokens, ready-for-dev state, Code Connect, annotations, measurements, and version comparison.
  - Streams implication: screenshot/Figma-to-code work should map designs to tokens/components/files and verify ready state, measurements, and responsive behavior.

### Ecommerce / marketing analytics

- Shopify web pixels docs: https://shopify.dev/docs/apps/build/marketing-analytics/pixels
  - Supports source-backed standards for: customer events, secure sandboxing, consent-aware event handling, checkout/post-purchase surfaces, and reduced DOM manipulation.
  - Streams implication: ecommerce marketing/analytics guidance must respect privacy/consent, use event/data-layer patterns, and avoid unsafe DOM scraping assumptions.

- Google Search SEO Starter Guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
  - Supports source-backed standards for: crawlability, page titles/snippets, useful content, site structure, internal links, and search-friendly pages.
  - Streams implication: marketing/SEO advice should use implementation-proof page structure, content usefulness, and measurable search hygiene rather than generic copy.

### Healthcare / privacy

- HHS HIPAA Privacy Rule: https://www.hhs.gov/hipaa/for-professionals/privacy/index.html
  - Supports source-backed standards for: privacy protections around individually identifiable health information and covered entity/business associate responsibilities.
  - Streams implication: healthcare workflows must minimize data, separate operational workflow help from diagnosis, protect PHI/PII, and keep provider-facing preparation privacy-first.

## Required build direction

The chat must not depend only on recent conversations or stored user memories. It must combine:

1. Live readiness from `/api/streams-builder/env-readiness`.
2. Repo/tool truth from Streams Builder capability files.
3. Source-backed knowledge packs loaded from code.
4. Retrieved project/file context when available.
5. User conversation context only as one signal, not the full knowledge boundary.

## Not yet complete

This file is a researched baseline, not the final highest possible knowledge layer. The next required work is to expand every domain into separate expert playbooks with citations, failure modes, troubleshooting trees, routing decisions, proof requirements, and evaluation cases.
