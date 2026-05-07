# Streams Current Status

## Active slice

- Standalone Streams Workspace Runtime Slice

## Proven items

- Browser Chat image history/session persistence (see previous proof on commit `b530c2362abcd5fc97c9574527a2ed9982352644`).

## Implemented but unproven items

- `lumen_chat_workspace_ui(1).jsx` was requested as the approved face, but that file is not present in this checkout; the production TSX shell is placed under `src/components/streams/workspace/**` and must be compared against the uploaded source before claiming exact visual parity.
- Standalone Streams Workspace Runtime Slice is authorized for a workspace runtime correction that serves the approved Streams workspace shell in standalone mode and wires it to real `/api/streams/chat` SSE events plus real chat session routes when `STREAMS_STANDALONE_PANEL=true` or `NEXT_PUBLIC_STREAMS_STANDALONE_PANEL=true` is configured.
- Target Vercel project name: `streamsailive-streamsai`.
- Target production URL: `https://streamsailive-streamsai.vercel.app`.

## Blocked items

- Live Vercel deployment proof is blocked until the Vercel token is available through a safe environment secret path and the separate Vercel project is configured with `STREAMS_STANDALONE_PANEL=true` and `NEXT_PUBLIC_STREAMS_STANDALONE_PANEL=true`.
- Production URL proof remains blocked until `https://streamsailive-streamsai.vercel.app` opens directly to the Streams panel without login, signup, marketing homepage, or auth redirect.
- Provider-backed runtime behavior remains unproven until required provider environment variables are configured in the separate Vercel project.
- Database-backed runtime behavior remains unproven until the separate deployment is pointed at an approved Supabase project and required migrations/env vars are applied.

## Target files for this slice

- `docs/streams-current-status.md`
- `middleware.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/streams/page.tsx`
- `src/components/streams/StreamsPanel.tsx`
- `src/components/streams/workspace/**`
- `src/contexts/AuthContext.tsx`
- `src/lib/streams/standalone-panel-mode.ts`

## Files that must not be touched

- Provider image/video routes
- DB migrations unless explicitly approved
- `scripts/validate-rule-confirmation.js`
- unrelated chat UI/editor/upload/settings/provider files
- `public/build-report.json`
- Provider credentials or secret-bearing `.env*` files
- `.git/**`
- `node_modules/**`
- `.next/**`

## Required proof before any item can be marked Proven

- Source proof in changed files
- Command/check proof from real command runner output
- Local build proof before claiming the source deploy target builds
- Vercel runtime proof before claiming the live domain works
- Browser/runtime proof that `/`, `/login`, `/signup`, and `/streams` render the workspace shell in standalone mode without login or marketing pages
- Persistence proof when durable storage/database behavior is claimed
