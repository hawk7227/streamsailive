# Streams Current Status

## Current active slice

- Full Build Only API Enforcement / OpenAI Call Prevention and Cost Control Runtime.

## Proven items

### Browser Chat image history/session persistence

Status: PROVEN

Proof recorded:
- deployed build report passed for commit `b530c2362abcd5fc97c9574527a2ed9982352644`
- browser generated image rendered inline
- browser refresh survived and hydrated chat image message
- `streams_artifacts` row exists with:
  - `id = 948de4e1-ef33-46c3-9a8e-990d13a2bc22`
  - `session_id = 88ec72fc-a249-476a-bfb7-1b65f7215702`
  - `type = image`
  - `created_by_chat = true`
  - `created_by_tab = null`
  - `preview_url = Supabase storage URL`
- `streams_chat_messages` rows exist:
  - user image prompt persisted with `metadata.directImageRequest = true`
  - assistant generated-image message persisted with `artifact_ids` containing `948de4e1-ef33-46c3-9a8e-990d13a2bc22`
  - assistant `metadata.kind = generated_image`
  - assistant `metadata.generatedImageUrl = Supabase URL`
  - assistant `metadata.artifactPersisted = true`

## Implemented but unproven items

### General Builder Runtime / STREAMS Self-Build Profile

Status:
- Implemented but unproven.

Notes:
- General Builder Runtime foundation work remains preserved as baseline context for this slice.
- STREAMS Self-Build Profile is one project profile/use case inside the General Builder Runtime.
- This is not the current active slice for the OpenAI prevention PR.

### Full Build Only API Enforcement / OpenAI Call Prevention and Cost Control Runtime

Status:
- Implemented but unproven.

Target files for this slice:
- `ASSISTANT_CONDUCT_RULES.md`
- `BUILD_RULES.md`
- `docs/streams-current-status.md`
- `docs/streams-knowledge/proof-classification.md`
- `docs/streams-knowledge/self-build-runtime.md`
- `docs/merge-policies/openai-call-prevention-slice.md`
- `scripts/full-build-gate.mjs`
- `scripts/scope-guard.mjs`
- `src/lib/assistant-core/orchestrator.ts`
- `src/lib/streams/ai-prevention/**`
- `src/lib/streams/openai-prevention/**`
- `src/lib/streams/build-runtime/build-quality-gate.ts`
- `src/lib/streams/build-runtime/context-packet-builder.ts`
- `src/lib/streams/build-runtime/correction-loop.ts`
- `src/lib/streams/build-runtime/knowledge-access.ts`

Files that must not be touched:
- Provider image/video routes
- DB migrations unless explicitly approved
- `scripts/validate-rule-confirmation.js`
- unrelated chat UI/editor/upload/settings/provider files
- repo-wide lint cleanup files
- `public/build-report.json`

Classification target for this slice:
- Implemented but unproven until runtime/provider/browser proof is captured.

## Historical inactive items

### Route Chat video-generation intent to native Streams video generation path

Historical slice:
- Route Chat video-generation intent to native Streams video generation path.

Original observed bug:
- Prompt: `Generate a VIDEO of a woman walking and talking on the phone.`
- Persisted metadata showed `metadata.directImageRequest = false`
- UI responded with plain-text fallback instead of native video generation path.

This item is historical/inactive and is not the current active slice.

## Blocked items

### Full Codex-like / General Builder execution loop

Blocked on:
- isolated workspace orchestration beyond local process
- durable task persistence wiring
- GitHub write path
- CI log APIs
- browser proof runner

### Claude runtime integration

Blocked where:
- no Anthropic provider call path is wired in the active runtime path.

### Batch dispatch execution

Blocked where:
- no async batch queue/dispatch worker is configured.

## Required proof before any item can be marked Proven

- Source proof in changed files
- Runtime proof through real API invocation
- Command/check proof from real command runner output
- Persistence proof when durable storage is claimed
- Browser/runtime proof where UI behavior is claimed
- Runtime/provider usage proof where token/cost savings are claimed
