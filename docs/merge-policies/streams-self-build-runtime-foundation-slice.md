# STREAMS Self-Build Runtime Foundation Slice Policy

## Allowed files
- `src/lib/streams/build-runtime/**`
- `src/app/api/streams/build/tasks/**`
- `docs/streams-knowledge/**`
- `docs/streams-current-status.md`

## Forbidden files
- `public/build-report.json`
- `scripts/validate-rule-confirmation.js`
- provider image/video routes
- database migrations
- unrelated UI/editor/provider settings files

## Required checks
- `git diff --check`
- `npx tsc --noEmit`
- `pnpm build`
- `node scripts/scope-guard.mjs`
- `node scripts/generated-file-guard.mjs`
- `node scripts/check-pr-ready.mjs`
- `pnpm streams:pr-ready`
