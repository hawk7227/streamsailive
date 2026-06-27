# Codex Builder Reliability Manifest

These instructions apply to Streams Builder / Codex-style autonomous build and repair code under `src/lib/streams-builder`.

## Prime directive

The builder must behave like a real autonomous coding agent, not a connected editor demo.

It must:

1. pull real source truth before editing
2. classify command risk before execution
3. run build/test/typecheck commands only inside sandboxed or approved context
4. start a repair loop when build/test/typecheck fails and autonomous repair is enabled
5. read failure logs before generating a repair patch
6. apply only controlled patches
7. rerun the failing command after every repair attempt
8. stop at max attempts if the failure is not fixed
9. create proof events for every lifecycle transition
10. keep push locked until diff, build proof, browser proof, and explicit user approval exist
11. create or expose rollback checkpoint state before patching
12. never claim Proven without source, build/test, browser/runtime, diff approval, and rollback proof where relevant

## Non-consolidated reliability layer

Do not collapse these concerns into one opaque helper. Keep them separately testable:

- command risk classifier
- repair lifecycle state machine
- browser verification hook
- diff approval state
- rollback checkpoint state
- live proof timeline
- worker repair loop connector
- iPhone chat command connector

## Command risk rules

Allowed automatically:

- read-only source inspection: `git status`, `git diff`, `git diff --check`, `cat`, `rg`, `ls`, `pwd`
- sandbox build/test/typecheck: `pnpm build`, `pnpm test`, `npx tsc --noEmit`, `pnpm exec tsc --noEmit`, `git apply --check`

Requires approval:

- `git add <specific files>`
- `git commit`
- `git push`
- PR create/merge/update commands
- unknown shell commands

Blocked:

- `git add .`
- destructive root deletes
- `sudo`
- shell-piped curl/wget installers
- broad chmod 777
- destructive SQL patterns

## Repair loop rules

On command failure:

```text
failure captured
→ classify failure
→ generate repair patch
→ apply patch
→ rerun failed command
→ repeat until pass or maxRepairAttempts exhausted
```

The repair loop must not push. It may only return an approval-ready diff when proof passes.

## Required proof events

Emit these when applicable:

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

## Test prompt

Use this prompt in the iPhone chat for a full reliability-path test:

```text
Agent 1, connect to Visual Editing and run a full Codex builder test on repo hawk7227/streamsailive branch main file src/app/streams-ai/page.tsx. Pull real source truth, queue autonomousRepair true with maxRepairAttempts 3, run build/typecheck proof, repair only if a failure happens, rerun until green or attempts are exhausted, show every proof event in the workstation, do not commit, do not push, and stop at approval required.
```

## Required checks

```bash
pnpm test src/lib/streams-builder/__tests__/codex-builder-reliability.test.ts
pnpm test src/lib/streams-builder/__tests__/codex-repair-loop.test.ts
pnpm test src/lib/streams-builder/__tests__/builder-chat-bridge.test.ts
pnpm build
```
