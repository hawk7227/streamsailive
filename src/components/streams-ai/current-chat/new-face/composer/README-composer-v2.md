# Streams Composer V2

Status: built as an isolated component, not mounted live.

Files:

- `StreamsComposerV2.jsx`
- `streams-composer-v2.css`

Live composer remains:

- `StreamsComposer.jsx`
- `streams-composer.css`
- `streams-composer-layout-fix.css`

Preview route placeholder:

- `/streams-ai/composer-v2-preview`

The V2 route is intentionally isolated and must not replace `/streams-ai` until browser testing proves:

1. Compact at rest.
2. Textarea grows inside one rounded composer.
3. Controls stay pinned to the bottom edge.
4. Enter sends on desktop.
5. Shift+Enter inserts a new line.
6. Mobile uses tap-send and Enter/newline behavior.
7. The live one-line composer remains unchanged until swap approval.
