# Streams Current Status

## Current authorized replacement slice

- Universal Project Workspace Replacement Conversion
- Streams Builder Preservation and Combination
- Documents 1 and 2 remain the governing requirements.
- This is a controlled replacement conversion, not a companion extension.
- `/streams-ai` remains the protected stable chat foundation while `/streams-ai/streams-builder` is the controlled universal-workspace construction and parity route.
- Existing Streams AI and Streams Builder capabilities must be preserved, combined, made durable where required, parity-tested, and moved behind reversible controls before any legacy surface is retired.

## Verified current classification

- Existing `/streams-ai` chat: protected and passing its response-integrity production contract.
- Existing `/streams-ai/streams-builder` capability chain: preserved and mounted inside the universal project workspace shell.
- Universal project workspace shell: implemented, mounted, production-tested, type-checked, built, and deployed.
- Durable builder workspace state: implemented using existing projects, jobs, and job events; browser localStorage remains compatibility cache only.
- Repository listing, tree, file read, Quick Source Push, and Reviewed Builder Push: routed through one shared scoped repository service while existing URLs and controls remain.
- Pull-request workflow: implemented using the verified preview branch, real GitHub checks, real reviews, approval gates, and durable PR identity.
- Precise line-patch planner: implemented and production-tested; precise range operations are preferred while controlled full-file replacement remains the fallback.
- Element-to-source mapping: implemented and production-tested; unresolved mappings fall back to the existing direct-value visual-to-code behavior rather than guessing.
- Browser Verification workstation: mounted and connected to real Playwright execution for desktop and mobile viewports.
- Browser verification evidence: console messages, network failures, proof steps, screenshots, checkpoint identity, and preview identity are persisted through existing Streams jobs, events, and assets.
- Native iOS, Android, and Kotlin Multiplatform work: later phases after the web replacement and mobile-safe contracts are complete and proven.

## Current implementation order

1. Freeze current capability inventory — completed.
2. Add preservation parity tests — completed and passing.
3. Add authoritative project workspace controller — completed and passing.
4. Mount existing builder inside universal layout — completed and passing.
5. Make workspace, active file, draft, checkpoint, preview, and proof state authoritative — completed using existing Streams persistence.
6. Unify repository actions and preserve both push paths — completed.
7. Add reviewed pull-request workflow — completed.
8. Strengthen source mapping and patch precision while preserving fallbacks — completed and production-tested.
9. Complete real browser verification evidence and active workspace controls — completed and production-tested.
10. Complete remaining versioned mobile-safe API wrappers around existing services — active.
11. Build KMP, SwiftUI, and Compose replacements only after the web replacement contract and APIs are stable and proven.

## Current production verification

Latest green production commit for the browser-verification contract repair:

- `4a4daa69fd89eed5b9785aab2df3efcf2c04a496`

Verified gates:

- Protected chat response-integrity tests pass.
- Universal workspace preservation tests pass.
- Universal workspace shell tests pass.
- Pull-request workflow tests pass.
- Precise line-patch planner test passes.
- Element-to-source mapping tests pass.
- Browser-verification contract tests pass without Node-only filesystem imports.
- TypeScript passes.
- Next.js production build passes.
- Vercel production deployment passes.

## Authoritative systems reused

- `streams.streams_ai_projects` for project ownership and active workspace pointers.
- `streams.streams_ai_jobs` for durable project-scoped builder state and verification jobs.
- `streams.streams_ai_job_events` for ordered meaningful state transitions.
- Existing Streams asset storage and `StreamsAIAssetsRepository` for browser-verification evidence.
- Existing Streams authentication and tenant/user/project scope for every operation.
- Existing conversations, messages, memory, context, intent, planning, progress, subscriptions, entitlements, and usage systems.

No duplicate project, task, event, memory, asset, account, billing, or builder database may be created.

## Active files added or extended in completed phases

### Universal workspace and durable state

- `src/components/streams-workspace/ProjectWorkspaceController.tsx`
- `src/components/streams-workspace/ProjectWorkspaceShell.tsx`
- `src/components/streams-workspace/BuilderWorkspacePersistenceBridge.tsx`
- `src/components/streams-workspace/ReviewedChangePersistenceBridge.tsx`
- `src/components/streams-workspace/BuilderPrecisionCompatibilityBridge.tsx`
- `src/lib/streams-builder/durable-workspace-state.ts`
- `src/app/api/streams-builder/workspace-state/route.ts`
- `src/app/api/v1/builder/workspaces/route.ts`

### Repository and pull requests

- `src/lib/streams-builder/repository-action-policy.ts`
- `src/lib/streams-builder/repository-action-service.ts`
- `src/lib/streams-builder/github-pull-request-service.ts`
- `src/app/api/v1/builder/repositories/route.ts`
- `src/app/api/v1/builder/files/route.ts`
- `src/app/api/v1/builder/repository-actions/route.ts`
- `src/app/api/v1/builder/pull-requests/route.ts`
- `src/components/streams-builder/PullRequestReviewPanel.tsx`

### Precise source mapping and patches

- `src/lib/streams-builder/line-patch-planner.ts`
- `src/lib/streams-builder/element-source-mapping.ts`
- `src/lib/streams-builder/ast-element-resolver.ts`
- `src/app/api/v1/builder/element-mappings/route.ts`

### Browser verification

- `src/lib/streams-builder/browser-verification.ts`
- `src/lib/streams-builder/browser-verification-route-handler.ts`
- `src/app/api/streams-builder/browser-verification/route.ts`
- `src/app/api/v1/builder/verifications/route.ts`
- `src/components/streams-builder/BrowserVerificationPanel.tsx`
- `src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx`

## Protected implementation rule

The following existing systems remain the active implementations and must not be rebuilt:

- `src/components/streams-builder/RuntimeCodeEditor.tsx`
- `src/components/streams-builder/VisualEditingWorkstation.tsx`
- `src/components/streams-builder/GitHubRepositoryPicker.tsx`
- `src/app/api/streams-builder/editable-preview/route.ts`
- Existing temporary branch and Vercel preview behavior.
- Existing source-truth, proof, approval, and builder event systems.

## Cutover rule

The old frontend may be retired only after the replacement is verified for complete feature parity in production and a tested rollback remains available.
