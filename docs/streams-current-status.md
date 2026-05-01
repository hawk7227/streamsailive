# STREAMS Current Status

This file is the source of truth for coding-agent handoff.

Before coding, read this file and follow it.

After every task, update this file only if the task changes project status, proof status, active slice, or next build order.

Do not mark anything Proven unless proof exists.

Every change must be classified as:

- Proven
- Implemented but unproven
- Blocked
- Rejected

## Repo / environment context

Repo:

```text
hawk7227/streamsailive
branch: main
local path: C:\Users\MARCUS\streamsailive
```

Important deployed test URL:

```text
https://octopus-app-4szwt.ondigitalocean.app/streams?tab=chat
```

Current DigitalOcean service has working env:

- `OPENAI_API_KEY` present
- `NEXT_PUBLIC_SUPABASE_URL` present
- `SUPABASE_SERVICE_ROLE_KEY` present
- `FAL_API_KEY` present

FAL/FLUX image route is working on octopus.

Coral service had previous FAL env mismatch. Do not use coral for proof unless its env is verified.

## Current active slice

Active slice:

```text
Browser Chat UI image history/session persistence
```

Target file:

```text
src/components/streams/UnifiedChatPanel.tsx
```

Allowed files for this active slice:

```text
src/components/streams/UnifiedChatPanel.tsx
docs/streams-current-status.md, only if status changes
```

Files not to touch for this active slice unless explicitly approved:

```text
scripts/validate-rule-confirmation.js
any audit script
any validation script
any config file
any schema/migration file
any unrelated UI file
any duplicate chat/session/artifact implementation
```

## Auto-continue rule

Codex may continue working without asking the user when all of these are true:

- the work is inside the current active slice
- the target files are listed in this file
- no schema, env, deployment, auth, billing, provider credential, or unrelated validation/audit file changes are required
- the next step is source code, typing, local build, or local test work
- the change can be classified as Implemented but unproven if runtime/browser/SQL proof is not available
- final changed files match the active slice file list

Codex must not stop just because browser, deploy, or SQL proof is missing.

Instead, it should complete the source slice, run available checks, open/update the PR, classify proof gaps honestly, update this status file, and report the exact manual proof still required.

## Hard stop rule

Codex must stop and ask the user only when:

- the active slice is unclear
- the task requires changing files outside the allowed file list
- the task requires database migration execution, production deploy access, provider credentials, browser proof, SQL proof, payment/billing changes, or destructive data actions
- the build requires weakening or bypassing an audit/validation/security rule
- the required implementation conflicts with existing STREAMS rules
- the agent cannot determine whether a change would create a duplicate system
- the next step would move to a new slice not listed as active

Do not stop for normal coding, refactoring within the allowed file, TypeScript fixes, local build errors caused by the current slice, or PR cleanup.

## PR cleanup rule

Before final response, Codex must run:

```bash
git diff --name-only origin/main...HEAD
```

If any file appears that is not listed under Allowed files for the active slice, Codex must revert that file before asking for merge.

Codex must not ask the user whether to revert unrelated files. It must revert them automatically.

Final response must include:

- final changed-file list
- tests/checks run
- classification
- proof completed
- proof still missing

## Continuation rule

After completing the current coding task, Codex may continue with follow-up fixes required to make that same slice build and pass local checks.

Codex may not start the next slice automatically.

When the active slice source work is complete, Codex must:

1. clean unrelated files from the PR
2. run required checks
3. update this status file if status changed
4. open/update the PR
5. report exactly what proof still requires the user

Then stop.

## Current proven state

### Image generation backend works

The working image path is:

```text
Streams chat or route
→ /api/streams/image/generate
→ falSubmit(...)
→ fal-ai/flux-pro or fal-ai/flux-pro/kontext
→ /api/streams/video/status polls queue
→ output uploaded to Supabase storage
→ artifactUrl returned
```

Earlier high-quality image output came from:

```text
fal-ai/flux-pro/kontext/text-to-image
```

Do not remove FAL/FLUX. It is the known quality baseline.

### Exact-size no-crop routing works

Runtime proof passed for custom exact size:

```bash
curl -i -X POST "https://octopus-app-4szwt.ondigitalocean.app/api/streams/image/generate" \
  -H "Content-Type: application/json" \
  --data '{"prompt":"generate a premium realistic product-style image with clean lighting","userId":"streams-test-user","width":200,"height":480,"numImages":1}'
```

Returned:

```json
{
  "status": "queued",
  "model": "flux-pro",
  "endpoint": "fal-ai/flux-pro",
  "exactSize": true,
  "width": 200,
  "height": 480,
  "qualityPolicy": {
    "tier": "premium_realistic",
    "provider": "fal",
    "noSilentDowngrade": true,
    "allowCrop": false,
    "reason": "selected provider because it supports native exact dimensions"
  },
  "persisted": false,
  "testMode": true
}
```

This proves:

- Exact-size routing: Proven
- Quality governor routing: Proven
- No-crop policy: Proven
- FAL flux-pro exact-size provider: Proven

### Artifact persistence works after migration

The Supabase migration for artifact/chat/session tables was applied manually through Supabase SQL Editor.

The status poll with real generationId, responseUrl, and a real sessionId proved artifact persistence:

```json
{
  "status": "completed",
  "artifactPersisted": true,
  "artifact": {
    "session_id": "34b10816-a9d7-4ede-bfe8-d60002e6e77d",
    "type": "image",
    "created_by_chat": true,
    "created_by_tab": null,
    "preview_url": "https://dggunmqrbimlsuaohkpx.supabase.co/storage/v1/object/public/generations/streams-public-test/ece41716-0ae3-4d8f-b92e-be5ff2789ee1.jpg"
  }
}
```

SQL proof showed:

```text
id: 57174d69-93e1-4a0b-86a3-4ca32d5abd85
session_id: 34b10816-a9d7-4ede-bfe8-d60002e6e77d
type: image
created_by_chat: true
created_by_tab: null
preview_url: Supabase storage URL
```

This proves:

- Chat session creation: Proven
- Status polling with sessionId: Proven
- Supabase storage upload: Proven
- Artifact DB persistence: Proven
- Chat ownership metadata: Proven

### Existing quality/artifact foundations are intact

Existing foundations that must be reused:

- `src/lib/streams/artifacts/artifact-contract.ts`
- `src/lib/streams/quality/quality-governor.ts`
- `supabase/migrations/20260430_streams_artifact_persistence.sql`
- `src/app/api/streams/artifacts/route.ts`
- `src/app/api/streams/chat/sessions/route.ts`
- `src/app/api/streams/chat/sessions/[sessionId]/messages/route.ts`
- `src/app/api/streams/video/status/route.ts`
- `src/app/api/streams/image/generate/route.ts`

Do not create a second artifact system.
Do not create a second quality system.
Do not create a second chat session system.

### Build-blocking Supabase clients were fixed

Several generation job routes previously created Supabase clients at module load, causing Next build failure when local env was incomplete.

Fixed and pushed commits:

- `192e124` Persist browser chat image history by session
- `471a342` Move generation job Supabase clients inside handlers
- `2184d43` Add Streams chat history client helper

Important note: commit `192e124` only changed bulk-job env handling, not the chat UI.

Commit `471a342` fixed generation job Supabase clients inside handlers.

Commit `2184d43` added:

```text
src/lib/streams/chat/chat-history-client.ts
```

The helper file built successfully. The build passed after the helper was added. The helper provides:

- `createStreamsChatSession(...)`
- `getLatestStreamsChatSession(...)`
- `getStreamsChatMessages(...)`
- `persistStreamsChatMessage(...)`

## Current implemented but unproven state

Browser Chat UI session/history wiring in:

```text
src/components/streams/UnifiedChatPanel.tsx
```

Expected implemented pieces:

- `sessionId` state
- `sessionHydrated` state
- `ensureChatSession`
- `hydrateLatestSession`
- `handleGenerateImageMessage` accepts `chatSessionId`
- image generation request includes `sessionId`
- status polling request includes `sessionId`
- normal chat request includes `sessionId`
- chat-history-client import present
- `persistStreamsChatMessage` usage for user messages
- `persistStreamsChatMessage` usage for assistant image messages
- `artifactId` on hydrated messages
- `artifactPersisted` metadata handling

Classification:

```text
Browser Chat UI runtime history wiring: Implemented but unproven
Browser-generated chat image surviving refresh: Unproven
Browser-generated chat image assistant message persisted with artifact_ids: Unproven
Browser Chat UI automatically loading latest session messages on refresh: Unproven
```

## Required proof for current active slice

Run source/build checks:

```bash
cd /c/Users/MARCUS/streamsailive

git diff --check src/components/streams/UnifiedChatPanel.tsx

grep -n "chat-history-client\|persistStreamsChatMessage\|hydrateLatestSession\|artifactPersisted\|artifactId\|sessionHydrated" \
  src/components/streams/UnifiedChatPanel.tsx

npx tsc --noEmit
pnpm build
```

Before final response, run:

```bash
git diff --name-only origin/main...HEAD
```

Expected final changed files for this active slice:

```text
src/components/streams/UnifiedChatPanel.tsx
```

If build passes and the PR is clean, deploy and verify:

```bash
curl -s "https://octopus-app-4szwt.ondigitalocean.app/build-report.json"
```

Expected deployed commit must match the merged commit hash.

Browser proof:

Open:

```text
https://octopus-app-4szwt.ondigitalocean.app/streams?tab=chat
```

Hard refresh.

Send:

```text
Generate an image of a woman walking and talking on the phone.
```

After image appears, refresh browser.

Expected:

- User prompt survives refresh
- Generated image survives refresh
- Assistant image message hydrates from DB
- Artifact row has `created_by_chat = true`
- Artifact row has `created_by_tab = null`
- Artifact row has `session_id` not null
- Chat assistant message has `artifact_ids` populated

SQL proof:

```sql
select
  id,
  session_id,
  type,
  created_by_chat,
  created_by_tab,
  preview_url,
  created_at
from public.streams_artifacts
where user_id = 'streams-test-user'
order by created_at desc
limit 10;
```

```sql
select
  session_id,
  role,
  content,
  artifact_ids,
  metadata,
  created_at
from public.streams_chat_messages
where user_id = 'streams-test-user'
order by created_at desc
limit 20;
```

Expected:

User message row:

- `role = user`
- `content = prompt`
- `metadata.directImageRequest = true`

Assistant message row:

- `role = assistant`
- `artifact_ids` contains image artifact id
- `metadata.kind = generated_image`
- `metadata.generatedImageUrl` is Supabase URL
- `metadata.artifactPersisted = true`

Only after this proof can you mark:

```text
Browser Chat image history persistence: Proven
```

## Current blocked items

Nothing currently blocked except final proof of the browser UI patch.

## Larger system plan still missing

### Slice 1 — Upload foundation

Status: Partial

Already exists:

- `src/components/streams/FileUpload.tsx`
- `src/app/api/streams/upload/route.ts`

Existing route uses signed Supabase upload URL. It does not yet prove:

- TUS/resumable upload for large/extra-large files
- upload DB records
- upload status persistence
- upload ownership records
- ingestion job trigger
- cross-device upload history

Left to build:

- `streams_uploads` table
- TUS upload support for large files
- upload progress bound to real upload state
- upload record after successful upload
- ingestion job creation after upload
- upload history/library

Do not send large files through Next.js route bodies.

### Slice 2 — Ingestion workers

Status: Mostly missing

Need real ingestion jobs for:

- documents
- images
- audio
- video
- ZIP
- YouTube links
- web links
- code bundles

Left to build:

- `streams_ingestion_jobs` table
- ingestion status route
- worker-safe ingestion functions
- document extraction
- image metadata/analysis queue
- audio extraction/transcription queue
- video extraction/keyframe/transcription queue
- ZIP unpack/index queue
- YouTube metadata/transcript path using official APIs only

No fake ingestion.

### Slice 3 — OpenAI file/vector integration

Status: Missing

Need:

- OpenAI Files upload
- OpenAI Vector Stores
- Responses API file_search
- `file_id` / `vector_store_id` stored per upload/project/session
- retrieval only loads relevant chunks

Do not fake file search with local substring search.

### Slice 4 — Media extraction

Status: Partial dependencies only

Dependencies like FFmpeg exist, but no proven production extraction worker is wired.

Need:

- ffprobe metadata extraction
- keyframe extraction
- audio extraction
- audio chunking for transcription limits
- video duration/fps/resolution metadata
- frame storage
- transcript storage

### Slice 5 — Analysis tools

Status: Partial / not production

Existing `VideoAnalysisUpload.tsx` and `/api/streams/check-video-accessibility` exist, but parts are mock/surface-level.

Need real tools:

- `analyze_image`
- `analyze_video`
- `analyze_audio`
- `analyze_document`
- `analyze_youtube`
- `analyze_reference`

For images/videos, analysis must support recreation, not only description.

### Slice 6 — Recreation compiler

Status: Missing

Need structured recreation briefs for:

- image recreation
- video recreation
- layout recreation
- document recreation
- UI recreation
- ad creative recreation
- product photo recreation

Output should include:

- subject spec
- composition spec
- lighting spec
- style spec
- camera/lens spec
- color palette
- typography if present
- object inventory
- motion path for video
- shot list for video
- timing/pacing
- provider recommendation
- exact size recommendation
- recreation confidence

### Slice 7 — Unified tool/action registry

Status: Missing

Requirement:

Chat must not duplicate tab logic.

Build one shared action registry where every tab registers capabilities and Chat invokes those same capabilities.

Tabs:

- Chat
- Editor
- Generate
- Reference
- Person
- Build
- Settings

Chat must be able to call actions behind all tabs:

- `generate_image`
- `generate_image_bulk`
- `generate_image_custom_size`
- `edit_image`
- `analyze_image`
- `recreate_image`
- `generate_text_to_video`
- `generate_image_to_video`
- `motion_transfer`
- `analyze_video`
- `recreate_video`
- `generate_voice`
- `generate_music`
- `upload_file`
- `ingest_file`
- `open_artifact`
- `edit_artifact`
- `save_artifact`
- `open_preview`
- `open_generate_tab`
- `open_editor_tab`
- `open_reference_tab`
- read/update safe settings

Do not duplicate Generate tab logic inside Chat.

### Slice 8 — Preview router

Status: Partial foundation exists

Existing:

- `src/lib/streams/artifacts/artifact-contract.ts`
- `decidePreviewPlacement()`

Still needs runtime wiring:

- inline chat preview
- right pane preview
- open in Generate tab
- open in Editor tab
- open in Reference tab
- preview state persistence
- refresh survival
- cross-device preview restore

Rules:

- images/videos/audio: inline + Generate/Library
- code/html/react: right pane + Editor
- documents/slides/pdf: preview pane + Editor
- tables/charts: inline + preview pane
- references/uploads: Reference tab

### Slice 9 — Provider capability router

Status: Partial foundation exists

Existing:

- `src/lib/streams/quality/quality-governor.ts`
- provider capability schema

Need full provider registry for:

- OpenAI image provider
- FAL/FLUX image provider
- exact-size image providers
- bulk providers
- video providers
- voice providers
- music providers

Provider capabilities must declare:

- supports exact dimensions
- supports aspect ratios
- supports bulk
- supports image-to-video
- supports text-to-video
- supports motion transfer
- supports voice
- supports music
- supports image edit
- supports upscale
- quality tier
- cost tier
- speed tier

### Slice 10 — Quality governor

Status: Partial foundation wired for image exact size

Proven:

- exact 200x480 image routed to flux-pro
- `allowCrop=false`
- premium realistic policy returned

Still needed:

- quality floor across all providers
- no silent downgrade
- provider escalation only to approved premium providers
- quality evaluation pass
- retry/escalation based on quality failure
- policy persisted per workspace
- OpenAI image adapter support
- custom exact-size provider fallback only when native support exists

### Slice 11 — Media generation wiring

Status: Partial

Proven:

- single image via FAL works
- exact-size image via FAL flux-pro works
- video generation previously returned completed mp4 through FAL/Kling status path

Still incomplete:

- bulk image generation real orchestration
- image-to-video from Chat
- text-to-video from Chat
- motion transfer from Chat
- voice from Chat
- music from Chat
- all Generate tab controls available to Chat
- autosave every output
- preview every output
- attach every output to session when generated by Chat

Existing job routes were described as foundational but not real provider runners. Do not claim they are full production media job workers until provider execution is real.

### Slice 12 — Persistence/autosave

Status: Partial

Proven:

- `streams_artifacts` table exists
- artifact row saves for generated image
- chat session row can be created
- chat-created artifact can attach to session when sessionId is passed

Still needed:

- browser Chat UI history proof
- messages survive refresh
- messages survive new browser
- messages survive mobile
- all generated media appears in library/history
- artifact versions wired
- preview state wired
- tab state optional
- uploads persisted
- ingestion jobs persisted
- generation jobs unified with artifact records

## Next build order after current slice is proven

Do not build next slices until the current browser Chat image history/session persistence slice is proven.

After current slice is proven, continue in this order:

1. Chat-generated image appears in Images/Generate/Library surfaces
2. Unified preview router runtime
3. Unified tool/action registry
4. Upload records + ingestion jobs
5. Large file TUS upload
6. OpenAI Files / Vector Stores
7. Media extraction and analysis
8. OpenAI image provider adapter

## Completion response format

At completion, report:

- Summary
- Changed files
- Tests/checks run
- Classification
- Proof provided
- Proof still missing
- Whether any unrelated files were reverted
