# STREAMS AI Current Chat Runtime Slice Policy

## Allowed files

- `src/components/streams-ai/current-chat/**`
- `docs/merge-policies/streams-ai-current-chat-runtime-slice.md`
- `scripts/scope-guard.mjs`

## Forbidden files

- `public/build-report.json`
- `scripts/validate-rule-confirmation.js`
- `supabase/migrations/**`
- unrelated provider route rewrites
- unrelated dashboard, pipeline, docs, auth, billing, or marketing files

## Required checks

- `git diff --check`
- changed-file ESLint for `src/components/streams-ai/current-chat/**`
- `npm run build`
- `node scripts/scope-guard.mjs`
- `node scripts/generated-file-guard.mjs`

## Classification

Implemented but unproven until Vercel deployment proves:

- `/streams-ai` creates URL-addressable sessions
- `/streams-ai/{sessionId}` reloads real history
- sidebar recent chats are real sessions
- Images/Videos/Search open real asset-backed views
- video generation uses the real provider/status path
