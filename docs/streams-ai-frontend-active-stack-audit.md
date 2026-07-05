# Streams AI Frontend Active Stack Audit

Branch: `frontend-confidence-audit-fixes`

Purpose: prevent developers from reusing deleted bridge files or one-off patch scripts while preserving the current approved Streams AI chat visual version.

## Approved current visual version

The current approved version is the dark Streams AI workspace with:

- left desktop sidebar
- centered empty state
- purple glowing composer
- `Ask, build, create, launch.` empty-state heading
- composer at the bottom of the chat surface

Do not redesign this look in this cleanup pass.

## Current source of truth

These files are required for the current approved `/streams-ai` version:

- `src/app/streams-ai/page.tsx`
- `src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx`
- `src/app/streams-ai/StreamsAIDesktopConsole.module.css`
- `src/app/streams-ai/StreamsAIMobileKeyboardBridge.jsx`
- `src/app/streams-ai/StreamsAIMobileChat.module.css`
- `src/app/streams-ai/StreamsAIMobileKeyboard.module.css`
- `src/components/streams-ai/current-chat/StreamsClientShell.jsx`
- `src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer.css`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`
- `src/components/streams-ai/current-chat/new-face/composer/chat-message-text-fix.css`

## Removed confusing files

These files were intentionally removed from the preview branch and should not be re-created or re-imported:

- `src/app/streams-ai/StreamsAIEmptyComposerPositionBridge.jsx`
  - Reason: it used polling, `MutationObserver`, DOM measurement, and inline `!important` layout mutation to position the composer.
  - Replacement: normal ChatPanel/composer layout ownership.

- `src/app/streams-ai/StreamsAIDesktopVisualBridge.jsx`
  - Reason: it injected runtime CSS into the page and created a second style owner for the same desktop composer/chat layout.
  - Replacement: desktop route rules live in `StreamsAIDesktopConsole.module.css`.

- `scripts/fix-streams-ai-mobile-source-truth.js`
  - Reason: one-off patch script for a prior repair. It is not runtime source code and can mislead future edits.

## Audit rules for future cleanup

- Do not delete files only because the filename looks old.
- Treat any file imported by a live route as runtime-active.
- Treat any file that injects global CSS, mutates DOM, patches `window.fetch`, or runs intervals/observers as high-risk active stack.
- Delete only files with direct evidence that they are no longer imported or are one-off patch scripts.
- Prefer one owner per behavior.

## Runtime entry for `/streams-ai`

Active route file:

- `src/app/streams-ai/page.tsx`

Current route stack after branch cleanup:

- `StreamsAIMobileKeyboardBridge` — active mobile viewport/keyboard variable bridge.
- `StreamsClientShell` — real client shell/runtime owner.
- CSS modules imported for desktop/mobile route styles.

## Active stack findings

### 1. Visual operator shell

File: `src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx`

Status: ACTIVE, CURRENT VISUAL SOURCE

Risk:

- Many components are compressed into one long file.
- Inline `styles` string controls large parts of layout.
- Hard to review and patch safely.

Keep for now because it currently renders the approved visual version.

Follow-up recommendation:

- Split into:
  - `StreamsOperatorShell.jsx`
  - `ChatPanel.jsx`
  - `SidebarNav.jsx`
  - `MobileDrawer.jsx`
  - `InlineBuildPanel.jsx`
  - `streams-operator-shell.css`

### 2. Desktop route CSS

File: `src/app/streams-ai/StreamsAIDesktopConsole.module.css`

Status: ACTIVE, ROUTE STYLE OWNER

This file now owns the desktop route style overrides that were previously in the deleted desktop visual bridge.

Keep for now because it helps preserve the approved desktop visual version.

### 3. Composer visual style

File: `src/components/streams-ai/current-chat/new-face/composer/streams-composer.css`

Status: ACTIVE, COMPOSER VISUAL OWNER

This file creates the approved purple glowing composer visual style. Do not delete it.

### 4. Composer layout behavior patch

File: `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`

Status: ACTIVE, COMPOSER AUTOSIZE CONTRACT

This file provides multiline textarea wrapping/growth behavior. Keep it until its rules are merged into `streams-composer.css` and visually checked.

### 5. Client shell fetch bridge

File: `src/components/streams-ai/current-chat/StreamsClientShell.jsx`

Status: ACTIVE, HIGH-RISK GLOBAL PATCH

Risk:

- Overrides `window.fetch` globally.
- Injects auth headers and file context.
- Intercepts `/api/streams-ai/messages` and `/api/streams-ai/tools`.
- Hides business logic outside explicit runtime calls.

Follow-up recommendation:

- Replace with explicit API client functions:
  - `sendStreamsMessage()`
  - `uploadStreamsAssets()`
  - `runStreamsTool()`
  - `attachAuthHeaders()`
  - `attachReadableFileContext()`

## Do-not-delete without deeper audit

- API routes under `src/app/api/**`
- Supabase/auth helpers
- migrations
- package/config files
- public assets
- generated reports that CI may depend on
- any file referenced by workflow scripts

## Next cleanup phase

1. Do not delete more `/streams-ai` runtime files until visual behavior is approved.
2. Keep the purple composer visual version.
3. Split `StreamsOperatorShell.jsx` into auditable components without visual change.
4. Merge `streams-composer-layout-fix.css` into `streams-composer.css` only after visual approval.
5. Refactor global `window.fetch` patch into explicit API clients in a separate PR.
