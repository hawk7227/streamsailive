# Streams Current Status

## Active slice

- STREAMS Self-Build Runtime Foundation
- Chat UI Slice (chat rail, composer UX, mobile shell fixes)
- Streams AI Work Narration & Protected Reasoning Slice
- Streams AI Item 3 — First Response to a Multi-Step Task
- Streams AI Compact Console Repair
- Streams AI Item 5 — Progress Update Structure
- Streams AI Items 6–40 — Human Work Behavior Program
- Streams AI Authorized Self-Reconstruction Supplement 2 — Records 152–255

## Proven items

- Browser Chat image history/session persistence (see previous proof on commit `b530c2362abcd5fc97c9574527a2ed9982352644`).
- Item 5 production deployment and browser-compatible test hotfix passed on main before this slice.
- Items 6–40 and narration fail-open repair are merged and deployed on main.

## Implemented but unproven items

- STREAMS Self-Build Runtime Foundation (in progress in this slice).
- Chat UI Slice mobile shell & double-sidebar fixes (hidden duplicate inner sidebar, hidden top actions and action status pill on mobile, hidden floating "Snap Pic Click" button on mobile, drawer hamburger menu, full width layout, mobile bottom message scroll spacer).
- Streams AI Work Narration & Protected Reasoning: live `/api/streams-ai/messages` requests are wrapped by the existing jobs/job-events ledger; user-visible text and persisted metadata pass through protected-field and credential sanitization; the `/streams-ai` page mounts persisted work history, refresh restoration, cross-tab synchronization, and server-side cancellation controls.
- Item 3 First Response to a Multi-Step Task: qualifying tasks are deterministically classified before operation creation; simple tasks bypass unnecessary operation narration; multi-step tasks persist `operation_started`, `plan_created`, and initial `phase_started` events with goal, plan version, phases, preservation constraints, risks avoided, clarification state, and next action before material execution; repeated idempotency keys recover the existing chat operation; the mounted history card restores and renders the accepted plan.
- Compact Console Repair: the zero-credit internal narration record reuses the already authorized live chat scope instead of requiring a second product-entitlement check; the active composer is forced into one compact non-wrapping row in empty and active chats; its duplicate live-status row is hidden; the console is clamped above the viewport safe edge; the conversation remains scrollable above it; persisted work history and Stop remain above the console.
- Item 5 Progress Update Structure: every durable operation event is normalized into a canonical progress record containing goal, completed work, current action, evidence level and summary, verification state, next action, remaining work, and plan version.
- Items 6–40 Human Work Behavior Program: one shared policy engine registers all 35 items; the live controller, jobs API, repository, model prompt, persistence layer, and restored activity UI support plan changes, reuse-first behavior, finding-first communication, decisions, truthful temporal language, tool/file updates, stable labels, micro-action suppression, continuity, preservation, blockers, partial completion, testing narration, final receipts, interruption/supersession, evidence-gated completion, and the default narration template.
- Authorized Supplement 2 Records 152–255: one typed registry contains all 104 records exactly once. Contextual activation injects language, uncertainty, assumptions, tool/connector, Gmail, Calendar, automation, source-of-truth, citation, file, spreadsheet/chart, image, ads, settings, memory, reasoning-summary, artifact/container, and web-limit rules into the live parity plan only when relevant. The deterministic response validator now rejects missing image-edit targets, unsupported temporal promises, protected operational disclosure, language inconsistency, generic offer endings, and raw internal source identifiers through the existing repair loop.

## Blocked items

- None declared for Supplement 2 before repository and deployment verification runs.

## Target files for this slice

- `docs/streams-current-status.md`
- `docs/merge-policies/streams-ai-work-narration-slice.md`
- `docs/merge-policies/streams-ai-authorized-supplement-2-slice.md`
- `scripts/scope-guard.mjs`
- `package.json`
- `src/app/streams-ai/page.tsx`
- `src/app/api/streams-ai/messages/route.ts`
- `src/app/api/streams-ai/jobs/route.ts`
- `src/components/streams-ai/current-chat/StreamsAIWorkHistoryBridge.jsx`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`
- `src/lib/streams-ai/protected-reasoning.ts`
- `src/lib/streams-ai/intelligence/parity-profile.ts`
- `src/lib/streams-ai/quality/deterministic-output-validator.ts`
- `src/lib/streams-ai/runtime/work-narration-controller.ts`
- `src/lib/streams-ai/runtime/task-complexity-classifier.ts`
- `src/lib/streams-ai/runtime/progress-update-structure.ts`
- `src/lib/streams-ai/runtime/human-work-narration-policy.ts`
- `src/lib/streams-ai/runtime/authorized-supplement-2-policy.ts`
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `tests/streams-ai-protected-reasoning.test.ts`
- `tests/streams-ai-first-response-planning.test.ts`
- `tests/streams-ai-progress-update-structure.test.ts`
- `tests/streams-ai-human-work-items-06-40.test.ts`
- `tests/streams-ai-authorized-supplement-2.test.ts`

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
- Vercel production build and deployment success
