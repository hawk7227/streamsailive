# Streams AI Work Narration & Protected Reasoning Slice

## Purpose

Connect the live `/streams-ai` message route to the existing Streams AI jobs/job-events ledger, render persisted activity history, enforce protected-reasoning boundaries, provide an authoritative first response for multi-step tasks, preserve one compact active composer across the first-message transition, and persist a canonical Item 5 progress update containing goal, completed work, current action, evidence, and next action without creating parallel persistence or changing provider routes.

## Allowed files

- `docs/streams-current-status.md`
- `docs/merge-policies/streams-ai-work-narration-slice.md`
- `scripts/scope-guard.mjs`
- `package.json`
- `src/app/streams-ai/page.tsx`
- `src/app/api/streams-ai/messages/route.ts`
- `src/app/api/streams-ai/jobs/route.ts`
- `src/components/streams-ai/current-chat/StreamsAIWorkHistoryBridge.jsx`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`
- `src/lib/streams-ai/protected-reasoning.ts`
- `src/lib/streams-ai/intelligence/parity-profile.ts`
- `src/lib/streams-ai/runtime/work-narration-controller.ts`
- `src/lib/streams-ai/runtime/task-complexity-classifier.ts`
- `src/lib/streams-ai/runtime/progress-update-structure.ts`
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `tests/streams-ai-protected-reasoning.test.ts`
- `tests/streams-ai-first-response-planning.test.ts`
- `tests/streams-ai-progress-update-structure.test.ts`

## Forbidden files

- `supabase/migrations/**`
- Provider image/video routes
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof

- Scope guard passes for the exact allowed list.
- TypeScript passes.
- The production contract suite passes, including Item 5.
- The full Next production build passes.
- Simple requests bypass unnecessary operation narration.
- Multi-step requests receive persisted `operation_started`, `plan_created`, and initial `phase_started` events before material execution.
- Every durable operation event stores a normalized progress object with goal, completed work, current action, evidence, next action, remaining work, and plan version.
- Restored activity history renders the five required user-facing fields without exposing private reasoning.
- Evidence labels distinguish evidence level and verification state.
- Duplicate idempotency keys recover the same chat operation.
- The accepted goal, phases, plan version, preserved items, risks avoided, and next action can be read back from `/api/streams-ai/jobs`.
- The same compact composer remains mounted before and after the first message.
- The duplicate two-row live-status console is suppressed.
- The composer remains clamped above the desktop and mobile safe edge.
- The conversation viewport remains visible and scrollable above the composer.
- Persisted work history and Stop render above the composer instead of overlapping or replacing it.
- Refresh restores the activity panel, accepted plan, and latest structured progress update.
- Stop transitions the authoritative job to `cancelled` and late completion cannot overwrite it.
- Protected fields do not appear in persisted message metadata, job input/output, job events, or restored UI payloads.
