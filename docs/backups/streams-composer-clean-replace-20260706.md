# Streams composer clean replace backup

This backup manifest was created before/alongside the clean composer replacement.

## Pre-clean-replace component

- Path: `src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx`
- Previous blob SHA: `fe1dcc68a0185c65454c615417b20e17a93aca0a`
- Last known old structure: single-row composer using `.streamsComposerRow` with add button, optional tool pill, textarea, model pill, mic button, and send button in the same row.
- Recovery command:

```bash
git show fe1dcc68a0185c65454c615417b20e17a93aca0a > src/components/streams-ai/current-chat/new-face/composer/StreamsComposer.jsx
```

## Pre-clean-replace layout CSS

- Path: `src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css`
- Previous blob SHA: `1811ce6cd33dcb0c5b1a7d865de49c0589521982`
- Recovery command:

```bash
git show 1811ce6cd33dcb0c5b1a7d865de49c0589521982 > src/components/streams-ai/current-chat/new-face/composer/streams-composer-layout-fix.css
```

## Clean replacement commits

- Component clean replace: `53edfb634247573767b331e50b35046f5c2d7061`
- CSS clean replace: `41d2523201767d9de1fdd424789217ab68616784`

This manifest preserves the exact prior Git blob references so the old section can be restored byte-for-byte from Git history if needed.
