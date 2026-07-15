# Streams AI Work Narration & Protected Reasoning Slice

## Purpose

Connect the live `/streams-ai` message route to the existing Streams AI jobs/job-events ledger, render persisted activity history, and enforce protected-reasoning boundaries without creating a parallel persistence system or changing provider routes.

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
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `tests/streams-ai-protected-reasoning.test.ts`

## Forbidden files

- `supabase/migrations/**`
- Provider image/video routes
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof

- Scope guard passes for the exact allowed list.
- TypeScript/build checks pass or any unrelated pre-existing failure is documented.
- Live `/api/streams-ai/messages` invocation returns a job ID.
- The job and ordered events can be read back from `/api/streams-ai/jobs`.
- Refresh restores the activity panel.
- Stop transitions the authoritative job to `cancelled`.
- Protected fields do not appear in persisted message metadata, job input/output, job events, or restored UI payloads.
