# chat-ui-slice

## Allowed
- `src/components/streams/UnifiedChatPanel.tsx`
- `src/components/streams/StreamsPanel.tsx`
- `docs/streams-current-status.md` (status-only updates)

## Must preserve in conflicts
- video intent routing
- image/video generation persistence
- session hydration
- artifact_ids and generated media metadata
- directImageRequest/directVideoRequest behavior
- media viewer/actions
- generation activity card
- revealActiveGeneration/follow-scroll
- browser-native VoiceBar entry
- calm streaming/useCalmStream

## Forbidden
- `public/build-report.json`
- provider routes
- DB migrations
- `scripts/validate-rule-confirmation.js`
- unrelated editor/upload/settings/provider files
