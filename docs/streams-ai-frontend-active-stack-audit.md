# Streams AI Frontend Active Stack Audit

Branch: `frontend-confidence-audit-fixes`

Purpose: separate runtime-active stacked files from safe dead-file cleanup candidates before merging UI behavior changes into `main`.

## Audit rules

- Do not delete files only because the filename looks old.
- Treat any file imported by a live route as runtime-active.
- Treat any file that injects global CSS, mutates DOM, patches `window.fetch`, or runs intervals/observers as high-risk active stack.
- Delete only files with direct evidence that they are no longer imported or are one-off patch scripts.
- Prefer one owner per behavior.

## Runtime entry for `/streams-ai`

Active route file:

- `src/app/streams-ai/page.tsx`

Current route stack after branch cleanup:

- `StreamsAIDesktopVisualBridge` — active desktop CSS bridge. Still active, but now no longer forces fixed 36px textarea height.
- `StreamsAIMobileKeyboardBridge` — active mobile viewport/keyboard variable bridge.
- `StreamsClientShell` — real client shell/runtime owner.
- CSS modules imported for desktop/mobile route styles.

Removed from route stack on this branch:

- `StreamsAIEmptyComposerPositionBridge` — deleted. It previously used a `MutationObserver`, interval polling, DOM measurement, and inline `!important` styles to reposition the composer. Composer layout is now owned by normal ChatPanel layout plus composer CSS.

## Active stack findings

### 1. Desktop visual bridge

File: `src/app/streams-ai/StreamsAIDesktopVisualBridge.jsx`

Status: ACTIVE, SIDE-EFFECT STYLE INJECTOR

Risk:

- Injects runtime CSS into the page.
- Controls chat scroll, composer, composer row, buttons, attachments, and empty state.
- Can conflict with component-owned CSS if not tightly scoped.

Branch action taken:

- Removed the fixed `grid-template-rows: 36px` composer layout.
- Removed forced textarea `height: 36px` and `line-height: 36px` behavior.
- Moved desktop composer into normal ChatPanel grid flow instead of overlay/fixed behavior.

Follow-up recommendation:

- Move the remaining bridge CSS into the real shell/component stylesheet or CSS module.
- Delete this bridge once the shell owns all desktop route styles.

### 2. Mobile keyboard bridge

File: `src/app/streams-ai/StreamsAIMobileKeyboardBridge.jsx`

Status: ACTIVE, ACCEPTABLE NARROW SIDE-EFFECT

Risk:

- Writes only `--keyboard` and toggles a keyboard class.
- Listens to viewport and focus events.

Keep for now because the responsibility is narrow and mobile keyboard behavior is platform-specific.

Follow-up recommendation:

- Keep as the only keyboard sidecar unless this behavior is moved into the shell runtime.

### 3. Client shell fetch bridge

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

### 4. Composer stack

Files:

- `src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer.css`
- `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`
- `src/components/streams-ai/current-chat/new-face/composer/chat-message-text-fix.css`

Status: ACTIVE, STACKED CSS OWNERSHIP

Risk:

- Multiple CSS files affect composer/message behavior.
- `layout-fix` files are historically risky because they often override real component styles.

Branch action taken:

- `StreamsComposer.jsx` owns textarea autosize logic.
- `streams-composer-layout-fix.css` owns explicit textarea soft-wrap/growth behavior.
- Desktop bridge no longer fights textarea growth.

Follow-up recommendation:

- Merge stable rules from `streams-composer-layout-fix.css` back into `streams-composer.css`.
- Delete `streams-composer-layout-fix.css` once stable.
- Audit `chat-message-text-fix.css` separately before deletion because it may affect live message readability.

### 5. Visual operator shell

File: `src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx`

Status: ACTIVE, OVER-COMPRESSED SOURCE FILE

Risk:

- Many components are compressed into one long file.
- Inline `styles` string controls large parts of layout.
- Hard to review and patch safely.

Follow-up recommendation:

- Split into:
  - `StreamsOperatorShell.jsx`
  - `ChatPanel.jsx`
  - `SidebarNav.jsx`
  - `MobileDrawer.jsx`
  - `InlineBuildPanel.jsx`
  - `streams-operator-shell.css`

## Dead/safe cleanup performed on this branch

### Deleted

- `src/app/streams-ai/StreamsAIEmptyComposerPositionBridge.jsx`
  - Reason: disabled and removed from `/streams-ai/page.tsx`; previous behavior was high-risk DOM polling/inline style mutation.

- `scripts/fix-streams-ai-mobile-source-truth.js`
  - Reason: one-off patch script for prior source-truth repair; no search hit indicated it is imported or called by runtime. Keeping it increases future patch confusion.

## Do-not-delete without deeper audit

- API routes under `src/app/api/**`
- Supabase/auth helpers
- migrations
- package/config files
- public assets
- generated reports that CI may depend on
- any file referenced by workflow scripts

## Next cleanup phase

1. Move remaining desktop bridge CSS into a real stylesheet owned by the shell.
2. Delete `StreamsAIDesktopVisualBridge.jsx` only after no import remains.
3. Refactor global `window.fetch` patch into explicit API clients.
4. Split `StreamsOperatorShell.jsx` into auditable components.
5. Consolidate composer CSS files after visual approval.
6. Run build, route test, keyboard test, zoom test, and mobile keyboard test.
