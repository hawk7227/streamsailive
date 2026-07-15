# Streams AI Work Narration & Protected Reasoning Slice

## Purpose

Connect the live `/streams-ai` message route to the existing Streams AI jobs/job-events ledger, render persisted activity history, enforce protected-reasoning boundaries, provide an authoritative first response for multi-step tasks, and preserve one compact active composer across the first-message transition without creating parallel persistence or changing provider routes.

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
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `tests/streams-ai-protected-reasoning.test.ts`
- `tests/streams-ai-first-response-planning.test.ts`

## Forbidden files

- `supabase/migrations/**`
- Provider image/video routes
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof

- Scope guard passes for the exact allowed list.
- TypeScript passes.
- The production contract suite passes.
- The full Next production build passes with required environment placeholders.
- Simple requests bypass unnecessary operation narration.
- Multi-step requests receive persisted `operation_started`, `plan_created`, and initial `phase_started` events before material execution.
- The internal zero-credit narration job does not repeat product-entitlement authorization after the live chat route has already authorized the user and scope.
- Duplicate idempotency keys recover the same chat operation.
- The accepted goal, phases, plan version, preserved items, risks avoided, and next action can be read back from `/api/streams-ai/jobs`.
- The same compact composer remains mounted before and after the first message.
- The duplicate two-row live-status console is suppressed.
- The composer remains clamped above the desktop and mobile safe edge.
- The conversation viewport remains visible and scrollable above the composer.
- Persisted work history and Stop render above the composer instead of overlapping or replacing it.
- Refresh restores the activity panel and accepted plan.
- Stop transitions the authoritative job to `cancelled` and late completion cannot overwrite it.
- Protected fields do not appear in persisted message metadata, job input/output, job events, or restored UI payloads.
