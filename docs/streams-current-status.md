# Streams Current Status

## Active slice

- STREAMS Self-Build Runtime Foundation
- Chat UI Slice (chat rail, composer UX, mobile shell fixes)
- Streams AI Work Narration & Protected Reasoning Slice

## Proven items

- Browser Chat image history/session persistence (see previous proof on commit `b530c2362abcd5fc97c9574527a2ed9982352644`).

## Implemented but unproven items

- STREAMS Self-Build Runtime Foundation (in progress in this slice).
- Chat UI Slice mobile shell & double-sidebar fixes (hidden duplicate inner sidebar, hidden top actions and action status pill on mobile, hidden floating "Snap Pic Click" button on mobile, drawer hamburger menu, full width layout, mobile bottom message scroll spacer).
- Streams AI Work Narration & Protected Reasoning: live `/api/streams-ai/messages` requests are wrapped by the existing jobs/job-events ledger; user-visible text and persisted metadata pass through protected-field and credential sanitization; the `/streams-ai` page mounts persisted work history, refresh restoration, cross-tab synchronization, and server-side cancellation controls. Source implementation is complete in the current branch; runtime, persistence, browser, and deployment proof are still required before classification as Proven.

## Blocked items

- Full Codex-like self-build loop remains blocked on runtime integrations (workspace orchestration beyond local process, durable task persistence wiring, GitHub write path, CI log APIs, browser proof runner).

## Target files for this slice

- `docs/streams-current-status.md`
- `src/lib/streams/build-runtime/**`
- `src/app/api/streams/build/tasks/**`
- `docs/streams-knowledge/**`
- `src/components/streams-ai/**`
- `src/app/streams-ai/**`
- `src/lib/streams-ai/protected-reasoning.ts`
- `src/lib/streams-ai/intelligence/parity-profile.ts`
- `src/lib/streams-ai/runtime/work-narration-controller.ts`
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `src/app/api/streams-ai/messages/route.ts`
- `src/app/api/streams-ai/jobs/route.ts`
- `tests/streams-ai-protected-reasoning.test.ts`

## Files that must not be touched

- Provider image/video routes
- DB migrations (unless explicitly approved)
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof before any item can be marked Proven

- Source proof in changed files
- Runtime proof through real API invocation
- Command/check proof from real command runner output
- Persistence proof when durable storage is claimed
- Browser/runtime proof where UI behavior is claimed
