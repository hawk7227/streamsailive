# STREAMS Agent Instructions

These instructions apply to all coding-agent work in this repository.

## Core rule

STREAMS is a strict production-only AI builder system.

Real implementation is allowed. Fake implementation is not. Delivery requires proof. Claims may never exceed proof.

Do not create fake layers.
Do not simulate missing functionality.
Do not create placeholder outputs.
Do not create duplicate systems.
Do not create route-as-worker hacks.
Do not use in-memory substitutes when durable persistence is claimed.
Do not create plain-text fallbacks for media generation when a real media path exists.

## Required status handoff

Before starting any STREAMS task, read:

```text
docs/streams-current-status.md
```

Do not code until you identify:

- active slice
- current Proven items
- current Implemented but unproven items
- current Blocked items
- target files
- files that must not be touched
- required proof before claiming Proven

If the requested task conflicts with `docs/streams-current-status.md`, stop and ask before coding.

## Classification rule

Every change must be classified as exactly one of:

- Proven
- Implemented but unproven
- Blocked
- Rejected

Never claim anything is built, wired, working, integrated, complete, production-ready, or done unless it is proven with the required evidence.

Required proof types:

- source proof
- runtime proof
- persistence proof, where persistence is claimed
- output proof, where generated outputs are claimed
- proof that fake, duplicate, or temporary layers are not in the critical path

## PR scope rule

Only change files required for the active slice.

Do not include unrelated audit, validation, formatting, config, cleanup, or refactor changes unless explicitly requested.

Before saying the task is complete, run:

```bash
git diff --name-only origin/main...HEAD
```

If any unrelated file appears, revert it before asking for merge.

For a feature PR, the final changed-file list must match the active slice.

## Active-slice rule

Before coding, identify:

- active slice
- target files
- existing foundations to reuse
- files that must not be touched
- proof required before the change can be marked Proven

If the user gives a target file, do not drift into unrelated files.

## Auto-continue rule

Codex may continue working without asking the user when all of these are true:

- the work is inside the current active slice
- the target files are listed in `docs/streams-current-status.md`
- no schema, env, deployment, auth, billing, provider credential, or unrelated validation/audit file changes are required
- the next step is source code, typing, local build, or local test work
- the change can be classified as Implemented but unproven if runtime/browser/SQL proof is not available
- final changed files match the active slice file list

Codex must not stop just because browser, deploy, or SQL proof is missing.

Instead, it should complete the source slice, run available checks, open/update the PR, classify proof gaps honestly, update `docs/streams-current-status.md`, and report the exact manual proof still required.

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
3. update `docs/streams-current-status.md` if status changed
4. open/update the PR
5. report exactly what proof still requires the user

Then stop.

## STREAMS architecture rule

Do not rebuild parallel systems.

Reuse existing foundations.

Current important foundations include:

- `src/lib/streams/artifacts/artifact-contract.ts`
- `src/lib/streams/quality/quality-governor.ts`
- `src/lib/streams/chat/chat-history-client.ts`
- `src/app/api/streams/artifacts/route.ts`
- `src/app/api/streams/chat/sessions/route.ts`
- `src/app/api/streams/chat/sessions/[sessionId]/messages/route.ts`
- `src/app/api/streams/video/status/route.ts`
- `src/app/api/streams/image/generate/route.ts`

Do not create a second artifact system.
Do not create a second quality system.
Do not create a second chat session system.
Do not create a second media generation system.

## Media generation rule

When a user asks for image generation in STREAMS chat:

- detect image intent before plain chat response
- call the real Streams image generation route/tool
- use the actual configured provider path
- render generated output inline in chat
- do not answer with “I can’t generate images”
- do not return sample Stable Diffusion code
- do not fake a generated image

Known working image path:

```text
Streams chat or route
→ /api/streams/image/generate
→ falSubmit(...)
→ fal-ai/flux-pro or fal-ai/flux-pro/kontext
→ /api/streams/video/status polls queue
→ output uploaded to Supabase storage
→ artifactUrl returned
```

Do not remove FAL/FLUX. It is the known quality baseline.

Exact-size custom image requests should route to a native exact-size provider when required. Do not claim arbitrary exact-size support from a provider unless documented and proven.

## Persistence rule

If an output is generated by Chat, it must be attached to the chat/session/artifact system.

For chat-created generated images, expected persistence includes:

- artifact row exists
- Supabase storage URL exists
- session_id is not null
- created_by_chat = true
- created_by_tab = null
- assistant chat message has artifact_ids populated
- metadata.kind = generated_image
- metadata.generatedImageUrl is the Supabase URL
- metadata.artifactPersisted = true when persistence is confirmed

## Browser chat history rule

For browser Chat UI history/session work, use:

- `src/components/streams/UnifiedChatPanel.tsx`
- `src/lib/streams/chat/chat-history-client.ts`

Required behaviors:

- hydrate the latest existing Streams chat session on load
- persist user messages
- persist assistant generated-image messages
- preserve artifactId / artifact_ids
- preserve generatedImageUrl
- preserve artifactPersisted metadata
- pass sessionId into `/api/streams/image/generate`
- pass sessionId into `/api/streams/video/status`
- hydrated generated-image messages must render inline after refresh

Do not store only in browser state when persistence is claimed.

## Build and verification commands

Use these checks when relevant:

```bash
git diff --check
git diff --name-only origin/main...HEAD
npx tsc --noEmit
pnpm build
```

If a build or audit fails due to pre-existing unrelated repo violations, report it honestly and include:

- exact command
- exact failure path
- whether the failure is related to the current slice
- what proof still passed

Do not hide failures by weakening validation scripts.

## Completion response format

At completion, report:

- Summary
- Changed files
- Tests/checks run
- Classification
- Proof provided
- Proof still missing
- Whether any unrelated files were reverted
