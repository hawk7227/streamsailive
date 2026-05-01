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

## Universal production rule

STREAMS is a strict production-only AI builder system.

Real implementation is allowed. Fake implementation is not. Delivery requires proof. Claims may never exceed proof.

Do not rebuild parallel systems. Do not create fake layers. Do not simulate missing functionality. Continue by wiring and upgrading the existing foundations already in the repo.

Do not claim anything is built, wired, working, integrated, complete, functional, production-ready, or done unless it is proven with:

- source proof
- runtime proof
- persistence proof, where persistence is claimed
- output proof, where generated outputs are claimed
- proof that fake, duplicate, or temporary layers are not in the critical path

## Hard no rules

- No route-as-worker hacks.
- No in-memory substitutes when durable persistence is claimed.
- No placeholder outputs.
- No simulated polling.
- No fake progress.
- No plain text fallback for media generation when a real generation path exists.
- No duplicate tool systems.
- No duplicate artifact systems.
- No duplicate chat/session systems.

## Repo / environment context

Repo:

```text
hawk7227/streamsailive
branch: main
local path currently used: C:\Users\MARCUS\streamsailive
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

## Current proven state

### 1. Image generation backend works

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

Earlier beautiful image quality came from:

```text
fal-ai/flux-pro/kontext/text-to-image
```

Do not remove FAL/FLUX. It is the known quality baseline.

### 2. Exact-size no-crop routing works

Runtime proof already passed for custom exact size:

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

### 3. Artifact persistence works after migration

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

### 4. Existing quality/artifact foundations are intact

Existing foundations that must be reused:

- `src/lib/streams/artifacts/artifact-contract.ts`
- `src/lib/streams/quality/quality-governor.ts`
- `supabase/migrations/20260430_streams_artifact_persistence.sql`
- `src/app/api/streams/artifacts/route.ts`
- `src/app/api/streams/chat/sessions/route.ts`
- `src/app/api/streams/chat/sessions/[sessionId]/messages/route.ts`
- `src/app/api/streams/video/status/route.ts`
- `src/app/api/streams/image/generate/route.ts`

Do not create a second artifact system. Do not create a second quality system. Do not create a second chat session system.

### 5. Build-blocking Supabase clients were fixed

Several generation job routes previously created Supabase clients at module load, causing Next build failure when local env was incomplete.

Fixed and pushed commits:

- `192e124` Persist browser chat image history by session
- `471a342` Move generation job Supabase clients inside handlers
- `2184d43` Add Streams chat history client helper

Important note: commit `192e124` only changed bulk-job env handling, not the chat UI.

Commit `471a342` fixed generation job Supabase clients inside handlers.

Commit `2184d43` added:

- `src/lib/streams/chat/chat-history-client.ts`

The helper file built successfully. The build passed after the helper was added.

The helper provides:

- `createStreamsChatSession(...)`
- `getLatestStreamsChatSession(...)`
- `getStreamsChatMessages(...)`
- `persistStreamsChatMessage(...)`

## Current partially done / incomplete state

### Active slice: Browser Chat UI image history/session persistence

Current file:

- `src/components/streams/UnifiedChatPanel.tsx`

Known current state after Codex patch:

- `src/components/streams/UnifiedChatPanel.tsx` was patched.
- Codex reported the active-slice source changes remain in `UnifiedChatPanel.tsx`.
- Codex reported session hydration, session reuse/creation, user-message persistence, assistant generated-image persistence, and session-aware route calls.
- Codex reported checks passed:
  - `git diff --check src/components/streams/UnifiedChatPanel.tsx`
  - `npx tsc --noEmit`
  - `pnpm build`

Current classification:

- `UnifiedChatPanel.tsx` source patch: Implemented but unproven
- Browser refresh survival: Unproven until deployed and browser-tested
- Artifact DB persistence from browser Chat: Unproven until SQL proof

Important PR hygiene status:

- The PR must not include `scripts/validate-rule-confirmation.js`.
- The final changed-file list for this active slice must be only:

```text
src/components/streams/UnifiedChatPanel.tsx
```

If `scripts/validate-rule-confirmation.js` appears in the PR, revert it before merge:

```bash
git checkout origin/main -- scripts/validate-rule-confirmation.js
```

Then commit and push the revert to the same PR branch.

## Required immediate next steps

### Step 1 — Clean current PR file list

Before merge, confirm GitHub `Files changed` shows only:

```text
src/components/streams/UnifiedChatPanel.tsx
```

If it also shows:

```text
scripts/validate-rule-confirmation.js
```

then do not merge.

Tell the agent to revert that file against main and rerun:

```bash
git status --short
git diff --name-only origin/main...HEAD
git diff --check src/components/streams/UnifiedChatPanel.tsx
npx tsc --noEmit
pnpm build
```

Expected final file list:

```text
src/components/streams/UnifiedChatPanel.tsx
```

### Step 2 — Merge only the clean UnifiedChatPanel.tsx PR

Recommended squash commit message:

```text
Wire browser chat image history to sessions
```

Recommended extended description:

```text
Persist and hydrate Streams chat image messages.

Changed file:
src/components/streams/UnifiedChatPanel.tsx

Classification:
UnifiedChatPanel.tsx source patch: Implemented but unproven
Browser refresh survival: Unproven until deployed/browser-tested
Artifact DB persistence from browser Chat: Unproven until SQL proof
```

### Step 3 — Verify deploy

After merge/deploy, verify the deployed commit:

```bash
curl -s "https://octopus-app-4szwt.ondigitalocean.app/build-report.json"
```

Expected deployed commit must match the new merged commit hash.

### Step 4 — Browser runtime test

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

- User prompt survives refresh.
- Generated image survives refresh.
- Assistant image message hydrates from DB.
- Artifact row has `created_by_chat = true`.
- Artifact row has `created_by_tab = null`.
- Artifact row has `session_id` not null.
- Chat assistant message has `artifact_ids` populated.

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

And:

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
- `metadata.generatedImageUrl = Supabase URL`
- `metadata.artifactPersisted = true`

Only after this proof can you mark:

```text
Browser Chat image history persistence: Proven
```

## What is complete / proven

Proven backend pieces:

1. FAL image generation route works.
2. Exact-size custom dimensions route to flux-pro.
3. No-crop policy is returned.
4. Quality governor is being used by image route.
5. Status route polls FAL and uploads result to Supabase storage.
6. Artifact autosave works after migration.
7. Chat-created artifacts can be saved with `session_id` and `created_by_chat=true` when status polling receives `sessionId`.
8. Generation job build blockers were fixed by moving Supabase clients inside handlers.
9. Chat history client helper exists and passes build.

## What is implemented but unproven

1. Browser `UnifiedChatPanel.tsx` history/hydration patch.
2. Browser-generated chat image surviving refresh.
3. Browser-generated chat image assistant message being persisted with `artifact_ids`.
4. Browser Chat UI automatically loading latest session messages on refresh.

These require build + deploy + browser + SQL proof.

## What is blocked

Nothing currently blocked except final proof of browser UI patch.

## Larger system plan still incomplete

Do not build these until the current active slice is proven.

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
- premium_realistic policy returned

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
- chat-created artifact can attach to session when `sessionId` is passed

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

## Bash safety rules from recent failures

Long heredocs and long pasted Python blocks kept getting cut off/corrupted in Git Bash.

Avoid:

```bash
cat > file <<'EOF'
huge file
