# Streams Builder Personal-Use Integration Capability Audit

## Purpose

This audit exists before any merge/build work. It is not a future roadmap and it is not a SaaS readiness document.

The only question is:

> Can Marcus ask the merged center chat for a task, and can it reach the right existing system/tool/backend while preserving each standalone system?

## Locked audit rules

- Do not look for what can be built later.
- Do not recommend future/SaaS work.
- Do not rebuild anything that already exists.
- Do not require runtime proof before planning.
- If code, route, component, or workflow exists and looks usable enough, count it as usable enough.
- Treat existing systems mostly as backend tools behind the merged chat.
- Marcus will test capability after the merge by giving the merged chat real requests.
- Only identify the smallest missing adapter needed for Marcus to call an existing capability from merged chat.

## Allowed status labels

- `BUILT / USABLE ENOUGH`
- `NEEDS ENV / KEY`
- `NEEDS SMALL CONNECTION`
- `NEEDS LIVE TEST ONLY`
- `NOT NEEDED FOR PERSONAL USE`

## Only allowed missing pieces

Only these can be listed as missing for this personal-use merge:

1. Center chat iframe embed
2. Active workstation context
3. Preview target flag
4. Chat-to-builder request bridge
5. Builder-to-existing-route adapter
6. Artifact/status return object

Anything beyond those is `NOT NEEDED FOR PERSONAL USE`.

---

# Current system audit

## 1. Streams Chat

### Needed personal-use capability

- Existing chat
- Saved conversations
- Uploads / document reading
- Assistant behavior
- Backend tool access enough for Marcus to request work
- Can be embedded in Builder center as an iPhone-sized iframe

### Existing usable pieces

- `src/app/api/streams-ai/messages/route.ts` supports reading persisted messages for a session with `GET`.
- The same route supports `POST` messages, creates a session if needed, stores user messages, stores assistant messages, and streams the assistant response.
- Message metadata already accepts arbitrary metadata and attachments.
- Assistant runtime already includes SSE-style events: `activity`, `response`, `tool`, `complete`, and `error`.
- Chat already has deterministic backend tool detection for listing capabilities, creating/listing tool jobs, listing assets, and looking up provider runs.
- Attachments are carried through message metadata and are processed into OpenAI image/file inputs when the assistant builds context.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

Merged Builder context is not yet attached to chat messages from the center iframe.

### Minimum needed connection

- Add Builder iframe mode query/context.
- Pass `workspaceId`, `workspaceLabel`, `previewTarget`, and optional `activeTool` into chat message metadata.
- Do not rewrite the chat system.

### Do not build

- Do not rebuild chat.
- Do not create a new saved conversation system.
- Do not create a new upload system unless the current upload route cannot pass assets to chat metadata.
- Do not create SaaS/multi-user changes for this phase.

---

## 2. Streams Builder

### Needed personal-use capability

- Builder workstations
- Codex-style builder/repair/troubleshoot foundation remains primary
- Preview/proof/status area
- Active workstation state
- Center chat iframe location
- Ability for chat to target a workstation
- Ability for workstation to receive status/artifact/output

### Existing usable pieces

- `src/components/streams-builder/WorkspaceGrid.tsx` exists and renders the Builder shell.
- Workstation/module labels already include Primary Builder, Visual Editing, Component Mapping, Approval Center, Browser Verification, Repository Truth, Projects Dashboard, and Truth Panel.
- Workspace selection state exists through `activeModule`.
- `WorkspaceModulePanel` exists as the compact module mount point.
- Production Builder route is live.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

The current shell needs the center chat iframe and explicit active-workstation/preview-target state.

### Minimum needed connection

- Remove/avoid unnecessary left sidebar duplication if the dropdown already owns selection.
- Add center iPhone-sized chat iframe.
- Add status/monitor area under iframe.
- Track active workstation ID.
- Track preview target: `builder-preview` or `chat-preview`.
- Do not rebuild Builder automation modules now.

### Do not build

- Do not remove Codex-style Builder foundation.
- Do not replace Builder with chat.
- Do not replace Builder with admingeneration.
- Do not build future full module dashboards right now.
- Do not rebuild repair loops unless current personal-use request cannot reach existing repair/tool paths.

---

## 3. Admingeneration Control Room

### Needed personal-use capability

- Generation control room
- Mode cards
- Provider routing
- Analyzer/reference video/edit mode
- Job submit route
- Enough backend access for merged chat to request image/video/voice/writer tasks

### Existing usable pieces

- `components/streams/opus-frame/OpusLockedFrame.jsx` defines generation mode cards:
  - Generate From Scratch
  - Text to Image
  - Image to Video
  - Text to Video
  - Voice & Captions
  - Snap Pic Click
  - Motion Graphics
  - AI Writers
  - Idea to Launch
- The same component submits generation requests to `/api/admingeneration/jobs`.
- The submit payload already includes `kind`, `provider`, `projectId`, `prompt`, `aspectRatio`, `duration`, and metadata.
- The component has source/reference link analysis through `/api/admingeneration/intake`.
- The UI includes provider choices: OpenAI, fal.ai, Runway, Kling, Veo, ElevenLabs.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

The merged chat needs a small route/tool adapter to call the existing job route instead of rebuilding the generation UI.

### Minimum needed connection

- Builder/chat can call existing `/api/admingeneration/jobs` with active workspace context in metadata.
- Return job status/result/artifact to the active workstation monitor/preview.
- Use `/admingeneration` as the existing generation backend/control room.

### Do not build

- Do not rebuild generation cards inside Builder.
- Do not create a second provider router.
- Do not split personal use across multiple Vercel apps unless those apps are only backend services.
- Do not create a new generation job route unless existing `/api/admingeneration/jobs` cannot accept the needed payload.

---

## 4. Existing generation submit route

### Needed personal-use capability

- One backend route that accepts generation jobs from chat/builder.
- Supports image, image-to-video, text-to-video, voice, motion, launch-style workflows.
- Routes providers based on kind/provider/env.
- Returns clean blocked states if keys/endpoints are missing.

### Existing usable pieces

- `src/app/api/admingeneration/jobs/route.ts` accepts `POST`.
- It defines generation kinds: `image`, `image-to-video`, `text-to-video`, `voice`, `snap-pick-click`, `motion`, and `launch`.
- It defines providers: `auto`, `openai`, `fal`, `runway`, `kling`, `veo`, and `elevenlabs`.
- It enforces `ADMIN_GENERATION_KEY` via `x-admin-generation-key` or bearer auth.
- It resolves providers by kind and environment variables.
- It persists job starts/provider runs/assets when Supabase service credentials exist.
- It returns blocked results for missing provider keys or endpoints instead of crashing.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

A server-side Builder adapter may need to include the admin key when calling this route from merged chat.

### Minimum needed connection

- Add a minimal Builder-side call path that sends:
  - `kind`
  - `provider`
  - `prompt`
  - `aspectRatio`
  - `sourceImageUrl`
  - `voiceId`
  - `projectId`
  - `metadata.workspaceId`
  - `metadata.conversationId`
  - `metadata.previewTarget`
- Return normalized status/artifact object to the active workstation.

### Do not build

- Do not create a new provider job route.
- Do not move provider code into Builder.
- Do not import broken provider files into Builder.

---

## 5. Provider access

### Needed personal-use capability

Only enough provider access for Marcus to ask the merged chat for generation tasks after merge.

### Existing usable pieces

The jobs route already supports provider selection and missing-key blocked states.

### Provider table

| Provider | Used for | Status | Minimum needed |
|---|---|---|---|
| OpenAI | chat, image, writers/planning | `NEEDS ENV / KEY` | `OPENAI_API_KEY`; optional image model env |
| fal.ai | image/video fallback, motion, snap-pick-click | `NEEDS ENV / KEY` | `FAL_API_KEY` or `FAL_KEY`; mode model env if needed |
| Runway | image-to-video/text-to-video | `NEEDS ENV / KEY` | `RUNWAY_API_KEY`; `RUNWAY_GENERATION_ENDPOINT` |
| Kling | video | `NEEDS ENV / KEY` | `KLING_API_KEY`; `KLING_GENERATION_ENDPOINT` or `KLING_EDIT_ENDPOINT` |
| Veo | video | `NEEDS ENV / KEY` | `VEO_API_KEY`; `VEO_GENERATION_ENDPOINT` or `VEO_EDIT_ENDPOINT` |
| ElevenLabs | voice/captions | `NEEDS ENV / KEY` | `ELEVENLABS_API_KEY`; `ELEVENLABS_VOICE_ID` |

### Minimum blocker

Provider env/key values must exist in local/Vercel for personal use.

### Minimum needed connection

No new provider architecture. Only verify env values and let existing route return clean blocked states if missing.

### Do not build

- Do not rebuild provider routing.
- Do not add provider UI unless needed to choose an existing provider.
- Do not let provider-specific TypeScript files break Builder production.

---

## 6. Uploads and document reading

### Needed personal-use capability

- Marcus can upload files in chat or workstation.
- Chat can use uploaded documents/images as context.
- Builder can preview or forward assets to existing workflows.
- Generation can use image/document references when the existing route supports it.

### Existing usable pieces

- Chat messages accept `attachments` in metadata.
- The assistant input builder handles image attachments as base64 `input_image` blocks.
- Non-image attachments are uploaded to OpenAI Files as `input_file` where possible.
- Attachments may come from Supabase storage bucket/path or URL/public URL.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

Builder needs to pass active workspace and preview target along with upload/attachment metadata.

### Minimum needed connection

- Do not create a new upload system first.
- Let chat attachments carry asset metadata.
- Let Builder read/forward those attachment records to active workstation/admingeneration if needed.

### Do not build

- Do not build a full asset management platform now.
- Do not rebuild document parsing unless the current OpenAI file/input path fails Marcus’s test.
- Do not duplicate files across systems unless needed for provider payload.

---

# Minimum personal-use merge checklist

The merge is enough for Marcus when:

1. `/streams-ai` still works standalone.
2. `/streams-ai/streams-builder` still works standalone.
3. `/admingeneration` still works standalone.
4. Builder has center chat iframe.
5. Builder tracks one active workstation.
6. Chat message metadata can include active workstation context.
7. User can choose Builder Preview or Chat Preview.
8. Chat can request a generation job through existing `/api/admingeneration/jobs`.
9. Chat can request backend/job/asset/provider status through existing Streams AI backend tool paths.
10. Uploaded files can travel as chat attachments and/or route payload references.
11. Output/status can appear in the active workstation monitor/preview.
12. No existing system loses its standalone behavior.

# Marcus test prompts after merge

Use these after the minimum merge:

```text
Use Workstation 1 to fix this page and show proof.
```

```text
Use Workstation 2 to generate an image from this prompt.
```

```text
Use Workstation 3 to turn this uploaded image into a video.
```

```text
Use Workstation 4 to read this document and create a launch plan.
```

If those requests reach the right existing backend/tool/workflow and return status/output to the active workstation, the personal-use merge works.
