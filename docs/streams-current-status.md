# Streams Current Status

## Current authorized replacement slice

- Universal Project Workspace Replacement Conversion
- Streams Builder Preservation and Combination
- Durable Project-Scoped Builder Workspace State
- Documents 1 and 2 are the governing requirements for this slice.
- This is a controlled replacement conversion, not a companion extension.
- Existing Streams AI and Streams Builder capabilities must be preserved, combined, made durable where required, parity-tested, and moved behind reversible controls before any legacy surface is retired.
- `/streams-ai` remains the protected stable chat foundation while `/streams-ai/streams-builder` is the controlled universal-workspace construction and parity route.

## Current slice classification

- Existing Streams intelligence and shared data foundation: Proven in source; runtime proof remains feature-specific.
- Existing `/streams-ai` chat: protected stable foundation; response-integrity production contract restored and passing.
- Existing `/streams-ai/streams-builder` builder capability chain: preserved and mounted inside the universal shell.
- Universal project workspace shell: source, focused tests, full production tests, TypeScript, Next production build, and Vercel deployment passed on commit `f34c5a9cd8a24b6e4c77f9baa80d13b4993b0a5c`.
- Builder active-file and visual-draft state: still browser-local and is the current completion target.
- Temporary preview records: still process-memory only and remain a later durable-state subphase.
- Native iOS, Android, and Kotlin Multiplatform work: later phases after the web replacement contract is stable.

## Current implementation order

1. Freeze the current capability inventory. Completed.
2. Add preservation parity tests. Completed and passing.
3. Add one authoritative project workspace controller. Completed and passing.
4. Mount the existing builder inside the universal shell. Completed and passing in source/build.
5. Make workspace, active file, draft, checkpoint, preview, and proof state authoritative and restorable using existing Streams projects, jobs, and job events. Active.
6. Unify repository actions while preserving Quick Source Push and Reviewed Builder Push.
7. Add stronger element/source mapping and precise patch generation while retaining current fallbacks.
8. Complete browser verification evidence and approval gates.
9. Add versioned mobile-safe API wrappers around existing services.
10. Build KMP, SwiftUI, and Compose replacements only after the web replacement contract is stable and proven.

## Proven items

- Browser Chat image history/session persistence.
- Existing `/streams-ai` response-integrity production contract.
- Universal workspace preservation contract: 9 tests passed.
- Universal workspace shell contract: 5 tests passed.
- Full Streams AI production suite: 111 tests passed.
- TypeScript and Next production build passed.
- Vercel production deployment passed for commit `f34c5a9cd8a24b6e4c77f9baa80d13b4993b0a5c`.
- Existing builder/editor internals remained the active implementation and were not rebuilt.

## Implemented but runtime/browser proof still required

- Universal shell visual layout on the public production alias.
- Complete click-through browser verification of repository controls, front-view editing, code editor, split preview, device review, source truth, and push gates.
- Existing Streams Builder browser features listed in the preservation contract.

## Current durable-state design

Reuse existing authoritative systems:

- `streams.streams_ai_projects` for project ownership and the active durable-state pointer/summary.
- `streams.streams_ai_jobs` for one non-billable, project-scoped builder workspace snapshot containing workspace state, active source file, draft, checkpoint, preview, selection, proof, and version metadata.
- `streams.streams_ai_job_events` for ordered meaningful state-transition events.
- Existing authentication and tenant/user/project scope for every read and write.
- Existing browser localStorage keys remain a migration cache only, not the authority.

No duplicate project, task, event, memory, asset, or builder database may be created.

## Current target files

### Status, scope, verification, and tests

- `docs/streams-current-status.md`
- `docs/merge-policies/universal-project-workspace-replacement-slice.md`
- `.github/workflows/universal-workspace-verify.yml`
- `scripts/scope-guard.mjs`
- `package.json`
- `tests/streams-ai-response-integrity.test.ts`
- `tests/streams-workspace-preservation-contract.test.ts`
- `tests/streams-workspace-shell-contract.test.tsx`
- `tests/streams-builder-durable-workspace-state.test.ts`

### Durable state

- `src/lib/streams-builder/durable-workspace-state.ts`
- `src/app/api/streams-builder/workspace-state/route.ts`
- `src/components/streams-workspace/workspace-state.ts`
- `src/components/streams-workspace/workspace-events.ts`
- `src/components/streams-workspace/ProjectWorkspaceController.tsx`

### Existing builder compatibility files

- `src/components/streams-builder/WorkspaceGrid.tsx`
- `src/components/streams-builder/GitHubRepositoryPicker.tsx`
- `src/components/streams-builder/VisualEditingWorkstation.tsx`
- Existing builder/editor files may be changed only when a parity test proves a narrowly scoped compatibility requirement.

## Files that must not be touched in this durable-state subphase

- Provider image/video routes.
- Database migrations unless existing tables cannot safely represent the required state and that limitation is proven.
- Billing or entitlement logic.
- Authentication implementation.
- Existing editor design or editing logic.
- Existing repository write APIs.
- `scripts/validate-rule-confirmation.js`.
- `public/build-report.json`.

## Durable-state completion gates

- Reads and writes require existing Streams tenant, user, and project scope.
- One authoritative state record is reused per project instead of creating a record on every keystroke.
- State survives browser refresh and server restart.
- Active file and draft restore from the server on another authorized browser/device.
- Existing localStorage keys are migrated and retained only as cache.
- Stale SHA and oversized payloads fail truthfully.
- Meaningful transitions can create ordered existing job events.
- Duplicate saves are idempotent.
- Focused tests, full production tests, TypeScript, Next build, and Vercel deployment pass.
- Existing `/streams-ai` chat contract remains green.

## Cutover rule

The old frontend may be retired only after the replacement is verified for complete feature parity in production and a tested rollback remains available.
