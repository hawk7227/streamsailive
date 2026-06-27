# Codex Builder Reliability Layer — Non-Consolidated Scope

This document is the non-consolidated reliability layer for the Streams Builder Codex-style agent. It is intentionally split into separate responsibilities so the system behaves like a real autonomous builder instead of only a connected chat/editor.

## Source of truth

The reliability layer must coordinate these existing foundations:

- `AGENTS.md`
- `src/lib/streams-builder/codex-builder-reliability.ts`
- `src/lib/streams-builder/codex-repair-loop.ts`
- `src/lib/streams-builder/repository-execution.ts`
- `src/lib/streams-builder/repository-worker.ts`
- `src/app/api/streams-builder/repository-execution/route.ts`
- `src/components/streams-builder/BuilderCenterChat.tsx`
- `src/components/streams-ai/current-chat/runtime/streamsBuilderModeBridge.js`
- `src/components/streams-ai/current-chat/runtime/streamsBuilderBridgeProof.js`

## 1. AGENTS.md builder manifest

Purpose: force every coding-agent run to follow the same production behavior.

Required behavior:

- Read repo status before coding.
- Identify active slice, source files, route, repo, branch, and proof required.
- Never claim complete without proof.
- Never create fake layers, placeholders, duplicate systems, or mock proof.
- Continue automatically through normal code/build/test repair inside the active slice.
- Stop before schema/env/deploy/auth/billing/credential/destructive changes.
- Require approval before staging, committing, pushing, or destructive commands.

Proof required:

- Changed files listed.
- Tests/build commands listed.
- Proof passed listed.
- Proof missing listed.
- Classification listed: Proven, Implemented but unproven, Blocked, or Rejected.

## 2. Command risk classifier

Purpose: decide whether the agent can run a command automatically.

Risk classes:

- `safe`: read-only commands like `git diff`, `git status`, `cat`, `rg`, `ls`.
- `sandboxed`: build/test/typecheck commands like `pnpm build`, `pnpm test`, `npx tsc --noEmit`, `git apply --check`.
- `approval_required`: unknown commands and write commands like `git add`, `git commit`, `git push`, PR creation/merge.
- `blocked`: destructive or unsafe commands like `git add .`, `rm -rf /`, `sudo`, shell-piped curl/wget, SQL drop/delete patterns.

Minimum behavior:

```text
command received
→ normalize command
→ block destructive patterns
→ require approval for git write/push
→ allow sandboxed build/test/typecheck
→ allow read-only source inspection
→ unknown commands require approval
```

## 3. Repair job lifecycle states

Purpose: make each repair job observable and auditable.

Required states:

```text
REQUEST_RECEIVED
SOURCE_TRUTH_READY
SANDBOX_READY
BUILD_RUNNING
BUILD_FAILED
REPAIR_CLASSIFIED
REPAIR_PATCH_GENERATED
REPAIR_PATCH_APPLIED
BUILD_RERUNNING
BUILD_PASSED
BROWSER_VERIFYING
BROWSER_VERIFIED
DIFF_AWAITING_APPROVAL
APPROVED_FOR_PUSH
PUSH_BLOCKED
ROLLBACK_READY
FAILED
```

Every state transition must create a proof event.

## 4. E2E worker repair test

Purpose: prove the Codex loop is more than a unit helper.

Required test shape:

```text
iPhone/workstation command
→ repository_execution job queued with autonomousRepair true
→ worker claims job
→ build command runs
→ failure captured
→ repair loop starts
→ patch generated
→ patch applied
→ build rerun
→ pass or max attempts exhausted
→ proof timeline returned
→ push remains locked until approval
```

Current source-level tests exist. A full browser/worker E2E test must be added when the local/prod worker execution environment is available.

## 5. Browser verification hook

Purpose: visual/user-facing work cannot be marked approved by source/build proof only.

Required behavior:

```text
build passed
→ route loads
→ runtime page responds
→ browser console checked
→ visual preview available
→ verification event emitted
→ approval can be requested
```

Browser proof must be required before approving frontend visual changes.

## 6. Diff approval state

Purpose: prevent automatic push after repair.

Approval states:

```text
not_ready
awaiting_approval
approved
rejected
```

A diff can only become approved when:

- changed files are known
- changed line count is known
- build passed
- browser verification passed for frontend work
- user explicitly approves

Push is locked until approval.

## 7. Rollback checkpoint state

Purpose: every autonomous repair must be reversible.

Required behavior:

```text
before patch
→ create checkpoint id
→ record repo/branch/files
→ record restore command
→ after patch/build proof, mark restore_ready
→ if user rejects or build fails unrecoverably, restore checkpoint
```

Rollback state must never be fake. If restore cannot be performed by the current runtime, it must be marked `restore_ready` and shown as manual proof still required.

## 8. Live proof timeline

Purpose: users must see the agent working instead of guessing.

Required live proof events:

```text
Codex builder request received
Source truth pulled
Sandbox prepared
Build running
Build failed
Failure classified
Repair patch generated
Repair patch applied
Build rerunning
Build passed
Browser verification queued
Browser verified
Diff awaiting approval
Push blocked until approval
Rollback checkpoint ready
```

Each event must include:

- state
- message
- severity
- timestamp
- optional data

## Required test prompt

Use this in the iPhone chat after the next patch:

```text
Agent 1, connect to Visual Editing and run a full Codex builder test on repo hawk7227/streamsailive branch main file src/app/streams-ai/page.tsx. Pull real source truth, queue autonomousRepair true with maxRepairAttempts 3, run build/typecheck proof, repair only if a failure happens, rerun until green or attempts are exhausted, show every proof event in the workstation, do not commit, do not push, and stop at approval required.
```

## Done means

This layer is not Proven until these pass:

```bash
pnpm test src/lib/streams-builder/__tests__/codex-builder-reliability.test.ts
pnpm test src/lib/streams-builder/__tests__/codex-repair-loop.test.ts
pnpm test src/lib/streams-builder/__tests__/builder-chat-bridge.test.ts
pnpm build
```

If worker/auth/env prevents live job execution, classify as Implemented but unproven and report the missing runtime proof.
