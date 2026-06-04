# Streams Current Status

## Active slice

- STREAMS Self-Build Runtime Foundation
- Chat UI Slice (chat rail, composer UX, mobile shell fixes)

## Proven items

- Browser Chat image history/session persistence (see previous proof on commit `b530c2362abcd5fc97c9574527a2ed9982352644`).

## Implemented but unproven items

- STREAMS Self-Build Runtime Foundation (in progress in this slice).
- Chat UI Slice mobile shell & double-sidebar fixes (hidden duplicate inner sidebar, hidden top actions and action status pill on mobile, hidden floating "Snap Pic Click" button on mobile, drawer hamburger menu, full width layout, mobile bottom message scroll spacer).
- Chat UI Slice preview/chat stabilization pass: shared split-preview artifact bridge with last-preview replay, embedded preview source hidden by default with show/hide toggle, active artifact preview opening, basic Builder Source candidate editor with dirty/discard/copy/save/preview-before-apply controls, composer provider payload restored, URL/YouTube submenu restored, realtime voice panel lazy-mounted, and web-search/status streaming cleanup. Source/type/test/route proof completed; authenticated browser chat-send proof still required.

## Blocked items

- Full Codex-like self-build loop remains blocked on runtime integrations (workspace orchestration beyond local process, durable task persistence wiring, GitHub write path, CI log APIs, browser proof runner).
- Authenticated browser proof for `/streams-ai` chat, preview, sidebar, and media generation requires a real logged-in Supabase session; unauthenticated local browser run redirects to `/login`.

## Target files for this slice

- `docs/streams-current-status.md`
- `src/lib/streams/build-runtime/**`
- `src/app/api/streams/build/tasks/**`
- `docs/streams-knowledge/**`
- `src/components/streams-ai/**`
- `src/app/streams-ai/**`

## Files that must not be touched

- Provider image/video routes
- DB migrations (unless explicitly approved)
- `scripts/validate-rule-confirmation.js`
- `public/build-report.json`

## Required proof before any item can be marked Proven

- Source proof in changed files
- Runtime proof through real API invocation
- Command/check proof from real command runner output
- Persistence proof when durable storage is claimed
- Browser/runtime proof where UI behavior is claimed
