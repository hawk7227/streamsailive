# EditorPro Import Notes

Imported from:
streamsai-editor-main/apps/web/src/app/editor/page.tsx

Primary test route:
src/app/editor-pro-test/page.tsx

Imported support files:
- public/browser-session.html
- public/ep-sw.js
- src/components/editor-pro/preview/*
- src/lib/editor-pro/preview-state.ts
- src/lib/editor-pro/staging.ts
- src/app/preview/*

This slice intentionally does not touch:
- src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js
- src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx
- normal sendMessage
- /streams-ai chat runtime

Known hardening still required:
- replace browser GitHub token flow with server-side GitHub auth
- wire EditorPro into /streams-ai only after /editor-pro-test is verified
- add SHA-safe approval/commit flow before public user launch
