# Streams Current Status

## Browser Chat image history/session persistence

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

## New active bug

Observed bug:
- Prompt: `Generate a VIDEO of a woman walking and talking on the phone.`
- Persisted metadata showed `metadata.directImageRequest = false`
- UI responded with plain-text fallback instead of native video generation path.

Current active slice:
- STREAMS Chat Runtime / Mobile Shell / Media UX Fix.
