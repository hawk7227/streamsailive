# Streams Current Status

## Current authorized replacement slice

- Universal Project Workspace Replacement Conversion
- Streams Builder Preservation and Combination
- Documents 1 and 2 are the governing requirements for this slice.
- This is a controlled replacement conversion, not a companion extension.
- Existing Streams AI and Streams Builder capabilities must be preserved, combined, made durable where required, parity-tested, and moved behind reversible controls before any legacy surface is retired.

## Current slice classification

- Existing Streams intelligence and shared data foundation: Proven in source; runtime proof remains feature-specific.
- Existing `/streams-ai/streams-builder` route and mounted builder capability chain: Implemented; preserve and parity-test before relocation.
- Universal project-centered workspace shell: Active implementation target.
- Native iOS, Android, and Kotlin Multiplatform work: Later phases; not part of the first web replacement commit.

## Current implementation order

1. Freeze the current capability inventory.
2. Add preservation parity tests for every protected builder capability.
3. Add one authoritative project workspace controller while retaining current events and component internals.
4. Mount the existing builder/editor/preview capabilities inside the universal project workspace shell.
5. Move browser-local and process-memory state to authoritative durable storage without changing user behavior.
6. Unify repository actions while preserving Quick Source Push and Reviewed Builder Push.
7. Add stronger element/source mapping and precise patch generation while retaining current fallbacks.
8. Complete browser verification evidence and approval gates.
9. Add versioned mobile-safe API wrappers around existing services.
10. Build KMP, SwiftUI, and Compose replacements only after the web replacement contract is stable and proven.

## Proven items

- Browser Chat image history/session persistence (see previous proof on commit `b530c2362abcd5fc97c9574527a2ed9982352644`).
- Item 5 production deployment and browser-compatible test hotfix passed on main before this slice.
- Items 6–40 and narration fail-open repair are merged and deployed on main.

## Implemented but unproven items

- STREAMS Self-Build Runtime Foundation.
- Chat UI Slice mobile shell and duplicate-sidebar repairs.
- Streams AI Work Narration and Protected Reasoning.
- Item 3 First Response to a Multi-Step Task.
- Compact Console Repair.
- Item 5 Progress Update Structure.
- Items 6–40 Human Work Behavior Program.
- Authorized Supplement 2 Records 152–255.
- Existing Streams Builder workspace, GitHub repository controls, editable frontend proxy, visual editor, GitHub-style runtime code editor, visual-to-code synchronization, split code/preview review, controlled patch workflow, temporary Git branches, Vercel preview polling, source-truth registry, browser-verification contract, approval foundation, and builder context events.

## Current replacement-slice target files

### Status, rules, and tests

- `docs/streams-current-status.md`
- `docs/merge-policies/universal-project-workspace-replacement-slice.md`
- `package.json`
- `tests/streams-workspace-preservation-contract.test.ts`
- `tests/streams-workspace-shell-contract.test.tsx`

### Universal workspace shell

- `src/components/streams-workspace/ProjectWorkspaceController.tsx`
- `src/components/streams-workspace/ProjectWorkspaceShell.tsx`
- `src/components/streams-workspace/ProjectTopBar.tsx`
- `src/components/streams-workspace/GlobalNavigationRail.tsx`
- `src/components/streams-workspace/ProjectContextPanel.tsx`
- `src/components/streams-workspace/WorkspaceCanvas.tsx`
- `src/components/streams-workspace/CanvasHeader.tsx`
- `src/components/streams-workspace/ContextInspectorPanel.tsx`
- `src/components/streams-workspace/WorkspaceBottomTray.tsx`
- `src/components/streams-workspace/ProjectOverviewBlock.tsx`
- `src/components/streams-workspace/workspace-state.ts`
- `src/components/streams-workspace/workspace-events.ts`

### Existing builder files permitted only for preservation wiring and compatibility

- `src/app/streams-ai/streams-builder/page.tsx`
- `src/components/streams-builder/WorkspaceGrid.tsx`
- `src/components/streams-builder/GitHubRepositoryPicker.tsx`
- `src/components/streams-builder/VisualEditingWorkstation.tsx`
- `src/components/streams-builder/RuntimeCodeEditor.tsx`
- `src/components/streams-builder/BuilderCenterChat.tsx`
- `src/components/streams-builder/BuilderControlLayers.tsx`
- `src/components/streams-builder/LiveFrontendWorkstation.tsx`
- `src/components/streams-builder/TopRowWorkstationControls.tsx`
- `src/components/streams-builder/VisualEditorScrollBehavior.tsx`
- `src/components/streams-builder/VisualOperationDock.tsx`
- `src/components/streams-builder/VisualPropertyInspector.tsx`
- `src/components/streams-builder/WorkstationChromeEnhancer.tsx`
- `src/components/streams-builder/VisualEditorCodeDock.tsx`
- `src/components/streams-builder/VisualSelectionPatchPanel.tsx`
- `src/components/streams-builder/WorkspaceBridgeSourceOfTruth.tsx`
- `src/components/streams-builder/BuilderContextEventSink.tsx`
- `src/components/streams-builder/CanonicalPreviewEventBridge.tsx`
- `src/components/streams-builder/CanonicalPreviewWorkspaceSurface.tsx`
- `src/components/streams-builder/PreviewCanvasFixStyles.tsx`
- `src/components/streams-builder/VisualEditorCanvasFixStyles.tsx`
- `src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx`
- `src/components/streams-builder/builderSystemContract.ts`

## Files that must not be touched in the first replacement slice

- Provider image/video routes.
- Database migrations.
- Billing or entitlement logic.
- Authentication implementation.
- `scripts/validate-rule-confirmation.js`.
- `public/build-report.json`.
- Existing editor internals unless a parity test proves a required compatibility change.
- Existing repository write APIs unless the current shell cannot be wired without a narrowly scoped compatibility change.

## Required proof before the first replacement slice can be marked Proven

- Source proof for every changed file.
- Preservation-contract tests proving protected builder capabilities remain present.
- TypeScript passes.
- Production build passes.
- The active `/streams-ai/streams-builder` route mounts the universal shell and the existing builder implementation.
- Browser proof confirms repository controls, frontend visual editing, GitHub-style code editor, matching line numbers, top tool section, visual-to-code synchronization, side-by-side preview, device review controls, source truth, and push gates remain reachable.
- No duplicate editor, preview, builder, project, chat, memory, jobs, asset, billing, or repository system is introduced.

## Cutover rule

The old frontend may be retired only after the replacement is verified for complete feature parity in production and a tested rollback remains available.
