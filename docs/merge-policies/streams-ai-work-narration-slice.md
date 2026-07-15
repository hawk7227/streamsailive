# Streams AI Work Narration & Protected Reasoning Slice

## Purpose

Connect the live `/streams-ai` message route to the existing Streams AI jobs/job-events ledger, render persisted activity history, enforce protected-reasoning boundaries, provide an authoritative first response for multi-step tasks, preserve one compact active composer, persist the canonical Item 5 progress update, and enforce Items 6–40 through one shared human-work narration policy rather than disconnected subsystems.

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
- `src/lib/streams-ai/runtime/human-work-narration-policy.ts`
- `src/lib/streams-ai/repositories/jobs-repository.ts`
- `src/lib/streams-ai/repositories/messages-repository.ts`
- `tests/streams-ai-protected-reasoning.test.ts`
- `tests/streams-ai-first-response-planning.test.ts`
- `tests/streams-ai-progress-update-structure.test.ts`
- `tests/streams-ai-human-work-items-06-40.test.ts`

## Forbidden files

- `supabase/migrations/**`
- Provider image/video routes
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof

- Scope guard passes for the exact allowed list.
- TypeScript passes.
- The production contract suite passes, including Items 5–40.
- The full Next production build passes in the real Vercel environment.
- Simple requests bypass unnecessary operation narration.
- Multi-step requests receive persisted `operation_started`, reuse assessment, `plan_created`, and initial `phase_started` events before material execution.
- Every durable operation event stores normalized progress and human-work policy data.
- Material plan changes persist the cause, previous and new plan versions, retained work, rejected alternatives, risk avoided, and replacement action.
- New user directions supersede prior active work in the same session while preserving completed work.
- Reuse is assessed before new construction.
- Findings and architectural decisions are persisted and rendered before their consequences are applied.
- Autosave, persistence, background, test, merge, deployment, and completion words are evidence-gated.
- Tool, file, attachment, research, repository, design, generation, and testing work carry domain-specific fields.
- Trivial micro-actions and repetitive activity are suppressed.
- Status labels are stable and accompanied by natural-language current action, evidence, and next action.
- Error, blocker, cancellation, supersession, and partial-completion states preserve completed work and identify retryability and required user action.
- Completion is rejected when required work remains, evidence is absent, or verification has not passed.
- Restored activity history renders goal, completed work, current action, evidence, next action, remaining work, findings, decisions, plan changes, preservation, risks, blockers, tool/file context, and terminal receipts without exposing private reasoning.
- Activity history remains collapsed by default, keyboard accessible, mobile-safe, cross-tab synchronized, and restorable after refresh.
- Duplicate idempotency keys recover the same chat operation.
- The same compact composer remains mounted before and after the first message.
- Stop transitions the authoritative job to `cancelled` and late completion cannot overwrite it.
- Protected fields do not appear in persisted message metadata, job input/output, job events, restored UI payloads, or final responses.
