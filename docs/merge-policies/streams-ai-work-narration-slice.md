# Streams AI Work Narration & Protected Reasoning Slice

## Purpose

Connect the live `/streams-ai` message route to the existing Streams AI jobs/job-events ledger, render persisted activity history, enforce protected-reasoning boundaries, and provide an authoritative first response for multi-step tasks without creating parallel persistence or changing provider routes.

## Allowed files

- `docs/streams-current-status.md`
- `docs/merge-policies/streams-ai-work-narration-slice.md`
- `scripts/scope-guard.mjs`
- `src/app/streams-ai/page.tsx`
- `src/app/api/streams-ai/messages/route.ts`
- `src/app/api/streams-ai/jobs/route.ts`
- `src/components/streams-ai/current-chat/StreamsAIWorkHistoryBridge.jsx`
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
- TypeScript/build checks pass or any unrelated pre-existing failure is documented.
- Simple requests bypass unnecessary operation narration.
- Multi-step requests receive a persisted `operation_started`, `plan_created`, and initial `phase_started` sequence before material execution.
- Duplicate idempotency keys recover the same chat operation.
- The accepted goal, phases, plan version, preserved items, risks avoided, and next action can be read back from `/api/streams-ai/jobs`.
- Live `/api/streams-ai/messages` invocation returns a job ID for qualifying tasks.
- Refresh restores the activity panel and accepted plan.
- Stop transitions the authoritative job to `cancelled` and late completion cannot overwrite it.
- Protected fields do not appear in persisted message metadata, job input/output, job events, or restored UI payloads.
