# video-quality-slice

## Allowed
- `src/app/api/streams/video/generate/route.ts`
- `src/app/api/streams/video/status/route.ts`
- provider capability/router files
- FAL/Kling provider files
- video post-processing/upscale files
- `docs/streams-current-status.md` (status-only updates)

## Must preserve
- existing ordinary video generation
- artifact persistence
- chat video status path
- provider metadata accuracy
- no fake provider capability

## Forbidden
- unrelated chat UI rail/media files
- Anchor Patch files
- DB migrations unless approved
- `scripts/validate-rule-confirmation.js`
