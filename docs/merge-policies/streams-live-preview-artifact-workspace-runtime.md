# streams-live-preview-artifact-workspace-runtime

## Allowed
- `docs/streams-current-status.md`
- `src/components/streams/UnifiedChatPanel.tsx`
- `src/app/api/streams/chat/route.ts` (artifact response shaping only)
- `src/components/streams/preview/**`
- `src/lib/streams/preview/**`
- `docs/merge-policies/**`

## Forbidden
- `public/build-report.json`
- `scripts/validate-rule-confirmation.js`
- provider image/video generation routes (`src/app/api/streams/video/**`, `src/app/api/streams/image/**`)
- video quality routing internals (`src/lib/streams/video/**`)
- DB migrations (`supabase/migrations/**`)
- unrelated upload/settings/provider/editor-video files
