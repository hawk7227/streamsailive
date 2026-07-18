# Universal Project Workspace Replacement Slice

## Purpose

Safely replace the current chat-first web frontend with the universal project-centered workspace while preserving and reusing the complete active Streams AI and Streams Builder capability set.

This is a replacement conversion, not a companion extension.

## Governing documents

- `StreamsAI_Universal_Workspace_Repository_Audit_and_Build_Plan(1).docx`
- `Build Rules for chat gpt.txt`

Both documents must be read end to end before starting or restarting this slice.

## Core preservation rule

Do not rebuild, simplify, duplicate, or disconnect a confirmed working system merely because it is being moved into the universal workspace.

The existing builder, visual frontend editor, GitHub-style code editor, repository controls, patch flow, temporary preview flow, source truth, proof, browser review, approval, and context events remain the implementation foundation.

## Active route

- `src/app/streams-ai/streams-builder/page.tsx`

## Allowed files

### Status, rules, and tests

- `docs/streams-current-status.md`
- `docs/merge-policies/universal-project-workspace-replacement-slice.md`
- `scripts/scope-guard.mjs`
- `package.json`
- `tests/streams-workspace-preservation-contract.test.ts`
- `tests/streams-workspace-shell-contract.test.tsx`

### Universal workspace shell

- `src/components/streams-workspace/**`

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

## Forbidden files in the first replacement slice

- `public/build-report.json`
- `scripts/validate-rule-confirmation.js`
- `supabase/migrations/**`
- Provider image/video routes
- Authentication implementation
- Billing, entitlements, and usage implementation
- Existing editor internals unless a failing preservation test proves a narrowly scoped compatibility change is required

## Protected capabilities

### Runtime code editor

Preserve `src/components/streams-builder/RuntimeCodeEditor.tsx` and all confirmed behavior:

- GitHub-style light file toolbar
- File path
- Line count
- Character count
- SHA
- Copy selection
- Download
- Edit tools
- More tools
- Utility/status row
- Cursor line and column
- Character offset
- History control
- Matching synchronized line-number gutter
- Search highlighting
- Selection highlighting
- Find
- Replace
- Go To
- Copy line
- Copy selection
- Copy all
- Highlight
- Circle
- Underline
- External visual-to-code commands

Do not replace it with Monaco, CodeMirror, a generic textarea, or a new editor.

### Editable frontend

Preserve `src/app/api/streams-builder/editable-preview/route.ts` and `src/components/streams-builder/VisualEditingWorkstation.tsx` behavior:

- Edit the rendered user-facing frontend
- Element classification
- Exact visual selection payload
- Parent and Child navigation
- Direct text editing
- Image replacement
- Remove/delete
- Rotate
- Front/z-index action
- Move and resize
- Selected-element toolbar
- Scroll-position preservation
- Safety blocking and recommendations
- Visual-to-source lookup
- Shared visual/code draft
- Patch and preview invalidation after edits

### Repository and preview workflow

Preserve:

- Repository listing
- Branch selection
- Folder selection
- File selection
- Exact file pull
- SHA tracking
- Quick Source Push
- Reviewed Builder Push
- Controlled patch generation
- Temporary Git branch creation
- Vercel preview polling
- Side-by-side code and preview
- Desktop and iPhone review
- Safari and Chrome framing
- Fullscreen and safe-zone review
- Source truth
- Proof
- Browser verification contract
- Approval gates
- Builder context events

## Implementation order

1. Freeze capability inventory.
2. Add preservation contract and tests.
3. Add one authoritative project workspace controller.
4. Mount existing components inside the universal workspace shell.
5. Make browser-local and process-memory state durable.
6. Unify repository action services while preserving both push paths.
7. Strengthen source mapping and patch precision while preserving fallbacks.
8. Complete browser verification evidence.
9. Add mobile-safe API wrappers.
10. Build native replacements only after web parity is proven.

## Proof gates

A change is not Proven until:

- Preservation tests pass.
- TypeScript passes.
- Production build passes.
- The active route mounts the universal shell and existing builder implementation.
- Browser proof confirms all protected editor, visual editing, repository, preview, proof, and push capabilities remain reachable and functional.
- No duplicate system is introduced.
- Rollback remains available.

## Cutover rule

No legacy frontend surface may be removed before the replacement is verified in production for complete feature parity and a tested rollback exists.
