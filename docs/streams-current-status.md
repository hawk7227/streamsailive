# Streams Current Status

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

## Historical inactive items

### Route Chat video-generation intent to native Streams video generation path

Historical slice:
- Route Chat video-generation intent to native Streams video generation path.

Original observed bug:
- Prompt: `Generate a VIDEO of a woman walking and talking on the phone.`
- Persisted metadata showed `metadata.directImageRequest = false`
- UI responded with plain-text fallback instead of native video generation path.

This item is historical/inactive and is not the current active slice.

## Current active slice

Active slice:
- STREAMS Premium Unified Video Editor Layout and Tool Surface

Allowed files:
- `src/components/streams/tabs/VideoEditorTab.tsx`
- `src/components/streams/editor/**`
- `docs/streams-current-status.md`
- `docs/merge-policies/editor-layout-slice.md`
- `scripts/scope-guard.mjs` policy registration only

Forbidden files:
- Provider image/video routes
- DB migrations unless explicitly approved
- `scripts/validate-rule-confirmation.js`
- unrelated chat UI/upload/settings/provider files
- repo-wide lint files
- `public/build-report.json`

Classification target for this slice:
- Implemented but unproven until browser/runtime evidence is captured.

## Implemented but unproven items

### STREAMS Self-Build Runtime Foundation

Status:
- Implemented but unproven.

Notes:
- This item is not the current active slice for this editor-layout PR.
- General Builder Runtime / STREAMS Self-Build Profile foundation work remains preserved as baseline context.
- Full Codex-like / General Builder execution loop is not complete until external runtime integrations are proven.

## Blocked items

### Full Codex-like / General Builder execution loop

Blocked on:
- workspace orchestration beyond local process
- durable task persistence wiring
- GitHub write path
- CI log APIs
- browser proof runner

## Required proof before any item can be marked Proven

- Source proof in changed files
- Runtime proof through real API invocation
- Command/check proof from real command runner output
- Persistence proof when durable storage is claimed
- Browser/runtime proof where UI behavior is claimed
