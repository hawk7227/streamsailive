# Streams AI Authorized Supplement 2 Slice

## Scope

Implement the uploaded authorized self-reconstruction supplement records 152–255 in the live `/streams-ai` response pipeline without creating parallel chat, persistence, tool, or provider systems.

## Architecture

- Reuse the existing parity prompt assembly and authoritative turn controller.
- Register all 104 records in one typed policy module.
- Activate only contextually relevant records for each request.
- Enforce request and response boundaries through the deterministic output validator so violations enter the existing repair loop.
- Keep existing human-work narration, protected-reasoning, persistence, cancellation, and compact composer behavior unchanged.

## Allowed files

- `src/lib/streams-ai/runtime/authorized-supplement-2-policy.ts`
- `src/lib/streams-ai/intelligence/parity-profile.ts`
- `src/lib/streams-ai/quality/deterministic-output-validator.ts`
- `tests/streams-ai-authorized-supplement-2.test.ts`
- `package.json`
- `scripts/scope-guard.mjs`
- `docs/streams-current-status.md`
- `docs/merge-policies/streams-ai-authorized-supplement-2-slice.md`

## Forbidden files

- Provider image/video routes
- Database migrations
- Generated build report
- Rule-confirmation implementation
- Existing composer and chat layout files

## Required proof

- Records 152–255 exist exactly once.
- Context activation is deterministic.
- Missing image-edit targets are rejected before false edit claims.
- Generic offer endings and raw reference IDs enter the repair gate.
- Unsupported background promises, protected operational disclosure, and clear language inconsistency are rejected.
- Conditional Gmail, Calendar, automation, citation, file, chart, image, ads, settings, memory, artifact, container, and web rules are injected only when relevant.
- The production contract suite, TypeScript, and Next production build pass.
- Vercel preview passes before merge.
