# Streams Builder Personal-Use Integration Capability Audit

## Purpose

This audit exists before any merge/build work. It is not a future roadmap, not a SaaS readiness document, and not a request to rebuild existing systems.

The only question is:

> Can Marcus ask the merged center chat for a task, and can it reach the right existing system/tool/backend while preserving each standalone system?

## Final locked audit rule

```text
Do not look for what can be built.
Do not recommend future/SaaS work.
Do not rebuild anything that already exists.
Do not require runtime proof before planning.
If code/route/component/workflow exists and looks usable, count it as usable enough.
Only identify the smallest missing adapter needed for Marcus to call it from merged chat.
```

## Updated personal-use audit rule

The audit checks only:

```text
1. Does the capability already exist somewhere?
2. Can the merged chat reach it with a minimal request/adapter?
3. Can the output/status come back to the active workstation?
4. Does the original standalone page still work?
```

That is it.

## Audit target

```text
Can Marcus ask the merged center chat for a task, and can it reach the right existing system/tool/backend while preserving each standalone system?
```

## What usable enough means

For personal use, a capability is usable enough when:

```text
A route, component, backend handler, provider path, or existing workflow exists,
and the merged chat can call it or open it without rebuilding it.
```

Marcus tests it by giving the merged chat a real request after the merge.

Example:

```text
Use Workstation 1 and turn this image into a video.
```

Then the merged chat should:

```text
know Workstation 1 is active
know preview target
send payload to existing admingeneration job route
show status in monitor
show output in the workstation or chat preview
save the conversation
```

## Backend reachability focus

Instead of auditing full UI polish, audit access paths:

```text
Chat access:
Can the center chat send the request?

Builder access:
Can the active workstation receive context, status, preview, and artifact?

Generation access:
Can /api/admingeneration/jobs receive a payload?

Provider access:
Are the keys/endpoints present enough for the provider path?

Upload access:
Can uploaded files become request assets?

Document access:
Can uploaded docs be read enough for the assistant to use them?
```

## No extra building rule

Do not recommend building a new feature if the capability can be reached through:

```text
existing route
existing page iframe
existing API
existing provider path
existing upload path
existing chat behavior
existing workstation preview/status area
```

Only recommend a small adapter when the chat cannot reach the existing capability.

## Only allowed missing pieces

Only these can be listed as missing for this personal-use merge:

```text
1. Center chat iframe embed
2. Active workstation context
3. Preview target flag
4. Chat-to-builder request bridge
5. Builder-to-existing-route adapter
6. Artifact/status return object
```

Anything beyond that is:

```text
NOT NEEDED FOR PERSONAL USE
```

## Allowed status labels

- `BUILT / USABLE ENOUGH`
- `NEEDS ENV / KEY`
- `NEEDS SMALL CONNECTION`
- `NEEDS LIVE TEST ONLY`
- `NOT NEEDED FOR PERSONAL USE`

---

# Current system audit

## 1. Streams Chat

### Needed personal-use capability

- Existing center chat behavior.
- Saved conversations.
- Uploads / document reading.
- Assistant behavior.
- Backend tool access enough for Marcus to request work.
- Can be embedded in Builder center as an iPhone-sized iframe or mounted Builder-specific wrapper.

### Existing usable pieces

- `src/app/api/streams-ai/messages/route.ts` supports reading persisted messages for a session with `GET`.
- The same route supports `POST` messages, creates a session if needed, stores user messages, stores assistant messages, and streams assistant responses.
- Message metadata already accepts arbitrary metadata and attachments.
- Assistant runtime already includes event-style outputs such as activity, response, tool, complete, and error.
- Chat already has backend tool detection for listing capabilities, creating/listing tool jobs, listing assets, and looking up provider runs.
- Attachments are carried through message metadata and are processed into OpenAI image/file inputs when the assistant builds context.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

Merged Builder context is not yet attached to center chat messages.

### Minimum needed connection

- Add Builder iframe mode or Builder-mounted chat mode.
- Pass `workspaceId`, `workspaceLabel`, `previewTarget`, and optional `activeTool` into chat message metadata.
- Preserve existing `/streams-ai` standalone behavior.
- Do not rewrite the chat system.

### Do not build

- Do not rebuild chat.
- Do not create a new saved conversation system.
- Do not create a new upload system unless the current upload route cannot pass assets to chat metadata.
- Do not create SaaS/multi-user changes for this phase.

---

## 2. Streams Builder

### Needed personal-use capability

- Builder workstations.
- Codex-style builder/repair/troubleshoot foundation remains primary.
- Preview/proof/status area.
- Active workstation state.
- Center chat iframe or mobile center chat mount.
- Ability for chat to target a workstation.
- Ability for workstation to receive status/artifact/output.

### Existing usable pieces

- `src/components/streams-builder/WorkspaceGrid.tsx` exists and renders the Builder shell.
- Workstation/module labels already include Primary Builder, Visual Editing, Component Mapping, Approval Center, Browser Verification, Repository Truth, Projects Dashboard, and Truth Panel.
- Workspace selection state exists.
- `WorkspaceModulePanel` exists as the compact module mount point.
- Production Builder route is live.
- `/streams-ai/streams-builder` exists as the nested Builder surface.
- `/streams-builder` exists as the standalone Builder surface.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

The shell needs center chat embed/mount and explicit active-workstation/preview-target state.

### Minimum needed connection

- Add center iPhone-sized chat iframe or mounted center chat.
- Add active workstation indicator/toggle.
- Add status/monitor area under or near center chat.
- Track active workstation ID.
- Track preview target: `builder-preview` or `chat-preview`.
- Return request status/artifact/output to the active workstation.
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

- Generation control room.
- Mode cards.
- Provider routing.
- Analyzer/reference video/edit mode.
- Job submit route.
- Enough backend access for merged chat to request image/video/voice/writer tasks.

### Existing usable pieces

- Existing admingeneration routes and editor routes exist.
- Existing job route `/api/admingeneration/jobs` exists.
- Existing mode/workflow concepts include Generate From Scratch, Text to Image, Image to Video, Text to Video, Voice & Captions, Snap Pic Click, Motion Graphics, AI Writers, and Idea to Launch.
- Existing workflows already use provider choices such as OpenAI, fal.ai, Runway, Kling, Veo, and ElevenLabs.
- Existing source/reference analysis routes exist for admingeneration.

### Personal-use status

`BUILT / USABLE ENOUGH`

### Minimum blocker

The merged chat needs a small route/tool adapter to call existing admingeneration routes instead of rebuilding the generation UI.

### Minimum needed connection

- Builder/chat can call existing `/api/admingeneration/jobs` with active workspace context in metadata.
- Return job status/result/artifact to the active workstation monitor/preview.
- Use `/admingeneration` as the existing generation backend/control room.

### Do not build

- Do not rebuild generation cards inside Builder.
- Do not create a second provider router.
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
- Existing kinds include image, image-to-video, text-to-video, voice, snap-pick-click, motion, and launch-style generation.
- Existing providers include auto, openai, fal, runway, kling, veo, and elevenlabs.
- Existing route enforces admin-generation access server-side.
- Existing route resolves providers by kind and environment readiness.
- Existing route persists job starts/provider runs/assets when Supabase service credentials exist.
- Existing route returns blocked results for missing provider keys/endpoints instead of crashing.

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

- Existing jobs route already supports provider selection.
- Existing readiness logic can mark provider access ready, blocked, or missing.
- Existing route can return clean blocked states if a provider key/path is missing.

### Provider table

| Provider | Used for | Personal-use status | Minimum needed |
|---|---|---|---|
| OpenAI | chat, image, writers/planning | `BUILT / USABLE ENOUGH` if key is present | use existing OpenAI env path |
| fal.ai | image/video fallback, motion, snap-pick-click | `BUILT / USABLE ENOUGH` if key is present | use existing fal env path |
| Runway | image-to-video/text-to-video | `BUILT / USABLE ENOUGH` if key/path is present | use existing Runway provider path |
| Kling | video | `BUILT / USABLE ENOUGH` if key/path is present | use existing Kling provider path |
| Veo | video | `BUILT / USABLE ENOUGH` if key/path is present | use existing Veo provider path |
| ElevenLabs | voice/captions | `BUILT / USABLE ENOUGH` if key/path is present | use existing ElevenLabs provider path |

### Minimum blocker

Provider env/key values must exist in local/Vercel for personal use, or the existing route must return a clean blocked state.

### Minimum needed connection

No new provider architecture. Only verify existing env/readiness paths and let existing routes return clean blocked states if missing.

### Do not build

- Do not rebuild provider routing.
- Do not add provider UI unless needed to choose an existing provider.
- Do not turn provider adapter work into a new generation system.

---

## 6. Uploads and document reading

### Needed personal-use capability

- Marcus can upload files in chat or workstation.
- Chat can use uploaded documents/images as context.
- Builder can preview or forward assets to existing workflows.
- Generation can use image/document references when the existing route supports it.

### Existing usable pieces

- Chat messages accept `attachments` in metadata.
- The assistant input builder handles image attachments as image inputs.
- Non-image attachments can be passed as file/document context where supported.
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
- Do not rebuild document parsing unless the current file/input path fails Marcus’s test.
- Do not duplicate files across systems unless needed for provider payload.

---

# Minimum personal-use merge checklist

The merge is enough for Marcus when:

1. `/streams-ai` still works standalone.
2. `/streams-ai/streams-builder` still works standalone.
3. `/admingeneration` still works standalone.
4. Builder has center chat iframe or center mounted chat.
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
