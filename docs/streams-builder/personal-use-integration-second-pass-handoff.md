# Streams Builder Personal-Use Integration Second-Pass Handoff

## Purpose

This is the second-pass clarification for the minimum personal-use merge.

It does not replace `personal-use-integration-capability-audit.md`. It keeps that audit intact and adds the missing handoff context so a developer or AI agent can complete the task without relying on the original conversation.

The goal is not to find more things to build. The goal is to make the minimum merge fully understood.

## Absolute rule

Do not use this document to expand scope.

Only connect existing systems enough for Marcus to personally use the merged chat as the command point for existing Builder, chat, upload, document, generation, provider, status, and preview capabilities.

## What Marcus wants

Marcus wants the existing Streams Chat, Streams Builder, and Admingeneration systems to work together for his personal use without losing any ability in any individual system.

The center Builder chat should become the request-change / ask-question / command area.

The Builder must remain the Codex-style automation foundation for:

- repo work
- file/component targeting
- repair loops
- troubleshooting
- build/typecheck feedback
- browser/mobile verification
- preview
- proof
- status
- approval

Admingeneration remains the existing generation backend/control room for:

- Generate From Scratch
- Text to Image
- Image to Video
- Text to Video
- Voice & Captions
- Snap Pic Click
- Motion Graphics
- AI Writers
- Idea to Launch
- analyzer/reference/edit modes
- provider routing
- `/api/admingeneration/jobs`

Streams Chat remains the existing chat system for:

- saved conversations
- uploads/attachments
- assistant behavior
- streaming responses
- message metadata
- backend tool access

## What must remain standalone

These routes must continue working individually after the merge:

- `/streams-ai`
- `/streams-ai/streams-builder`
- `/admingeneration`

The merge must not break or replace them.

## Minimum merge only

Only these six missing pieces are allowed:

1. Center chat iframe embed
2. Active workstation context
3. Preview target flag
4. Chat-to-builder request bridge
5. Builder-to-existing-route adapter
6. Artifact/status return object

Nothing else is needed for this phase unless one of those six cannot work without it.

## What not to add

Do not add:

- new chat system
- new generation system
- new provider router
- new upload platform
- new SaaS user system
- new billing system
- new public onboarding
- new large dashboard modules
- new future-proof architecture layer
- unrelated cleanup
- code rewrites that are not needed for Marcus personal use

## Active workstation rule

Every request from the merged chat must know its active workstation.

Minimum context:

```json
{
  "workspaceId": "workspace-1",
  "workspaceLabel": "Workspace 1",
  "conversationId": "existing-chat-session-id",
  "previewTarget": "builder-preview",
  "activeTool": "builder-or-admingeneration",
  "activeMode": "code-or-generation-or-document"
}
```

This context should be saved in chat message metadata when possible.

## Preview target rule

The user must be able to choose:

- `builder-preview`
- `chat-preview`

`builder-preview` means output/status/artifact appears in the active workstation.

`chat-preview` means output/status/artifact appears inside the chat frame when existing chat behavior supports it.

Do not build a large new preview system just for this phase. Use the existing workstation/status/preview space enough to display the returned status or output.

## Chat iframe rule

Embed the existing `/streams-ai` page in the center of Builder as an iPhone-sized iframe.

Do not import the chat UI directly into the Builder.

Do not rewrite `/streams-ai`.

The iframe can receive Builder context through query parameters and/or a small message bridge.

## Request bridge rule

The center chat should not directly mutate unrelated systems.

It should send a request with context to Builder.

Builder decides whether the request is for:

- existing Builder/Codex repair path
- existing admingeneration route
- existing Streams AI backend tool/status lookup
- existing upload/document path

## Existing-route adapter rule

For generation tasks, the adapter should call the existing route:

```text
/api/admingeneration/jobs
```

Do not build another generation route if this one accepts the needed payload.

Minimum payload shape:

```json
{
  "kind": "image",
  "provider": "auto",
  "prompt": "user request",
  "aspectRatio": "16:9",
  "sourceImageUrl": "optional uploaded image url",
  "voiceId": "optional voice id",
  "projectId": "optional existing project id",
  "metadata": {
    "source": "streams-builder-merged-chat",
    "workspaceId": "workspace-1",
    "conversationId": "chat session id",
    "previewTarget": "builder-preview"
  }
}
```

## Output/status return rule

The active workstation only needs a normalized result object for personal use:

```json
{
  "ok": true,
  "workspaceId": "workspace-1",
  "conversationId": "chat session id",
  "requestType": "generation-or-builder-or-document",
  "status": "submitted-or-completed-or-blocked-or-failed",
  "provider": "openai-or-fal-or-runway-or-kling-or-veo-or-elevenlabs",
  "jobId": "optional job id",
  "artifact": {
    "kind": "image-or-video-or-audio-or-document-or-text-or-log",
    "url": "optional output url",
    "text": "optional output text",
    "mimeType": "optional mime type"
  },
  "error": "optional clear error"
}
```

This is enough for the workstation monitor/preview to show what happened.

## Upload/document rule

Do not rebuild uploads or document reading now.

Use existing chat attachments and message metadata first.

For personal use:

- image uploads can travel as attachment metadata or `sourceImageUrl`
- documents can remain chat attachments
- chat can use existing OpenAI file/image input handling
- Builder can forward attachment metadata to the active route when needed

Only build more if Marcus tests and the existing attachment path cannot reach the active request.

## Provider rule

Provider code must stay behind existing admingeneration/jobs route.

Builder should not import provider runtime files directly.

Provider missing-key states are acceptable for personal use as long as they return clear blocked states and do not break production.

## Minimum request flows

### Code/build request

Marcus asks:

```text
Use Workstation 1 to fix this page and show proof.
```

Expected minimum behavior:

1. Chat saves the message normally.
2. Chat message includes active Workstation 1 context.
3. Builder knows Workstation 1 owns the request.
4. Existing Builder/Codex-style path handles the work or status.
5. Workstation 1 receives status/proof/output.

### Image generation request

Marcus asks:

```text
Use Workstation 2 to generate an image from this prompt.
```

Expected minimum behavior:

1. Chat saves the message normally.
2. Builder context says Workstation 2 is active.
3. Builder/admingeneration adapter sends `kind: image` to `/api/admingeneration/jobs`.
4. Result/status returns to Workstation 2.
5. Output appears according to preview target.

### Image-to-video request

Marcus asks:

```text
Use Workstation 3 to turn this uploaded image into a video.
```

Expected minimum behavior:

1. Uploaded image remains a chat attachment or asset reference.
2. Builder context says Workstation 3 is active.
3. Adapter sends `kind: image-to-video` and source image reference to `/api/admingeneration/jobs`.
4. Provider blocked/missing-key states are shown clearly if necessary.
5. Result/status returns to Workstation 3.

### Document/writer request

Marcus asks:

```text
Use Workstation 4 to read this document and create a launch plan.
```

Expected minimum behavior:

1. Uploaded document remains a chat attachment.
2. Chat uses existing assistant attachment handling.
3. If needed, Builder/admingeneration adapter sends launch/writer-style request through existing route.
4. Result/status returns to Workstation 4.

## Final decision rule

If an existing route/component/workflow can handle the request with one of the six allowed missing pieces, use it.

If the work is not required for Marcus to personally test the merged chat now, mark it `NOT NEEDED FOR PERSONAL USE`.

## Final success condition

The personal-use merge is successful when Marcus can give the merged center chat one real request and see the right existing backend/workflow respond through the active workstation without breaking the standalone systems.
