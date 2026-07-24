# Streams authoritative runtime architecture

## Runtime flow

```text
Mobile/Web Client
  -> API Gateway (`/api/streams-ai/messages`)
    -> deterministic product intent router
    -> canonical message persistence
    -> authoritative operation ledger
    -> website builder executor (when required)
    -> preview persistence
    -> execution-truth response composer
    -> SSE artifact/complete events
```

General conversation remains in the existing authoritative response controller. Product actions never rely on prompt wording alone and may not claim completion without operation and artifact proof.

## Sources of truth

- Conversation truth: `streams.streams_ai_chat_messages`
- Operation truth: `streams.streams_ai_operations`
- Operation event truth: `streams.streams_ai_operation_events`
- Preview truth: `streams.streams_ai_previews` and `streams.streams_ai_preview_versions`
- Capability truth: `/api/streams-ai/capabilities`

## Hard invariants

1. The user message is persisted before provider or builder execution.
2. A failed operation creates a durable failed assistant turn.
3. Website requests never invoke current-source search unless the user separately requests research.
4. `built`, `saved`, `deployed`, `opened`, and `ready` claims require runtime proof.
5. `Open preview`, `What happened?`, `Try it again`, and `Cancel` are deterministic commands.
6. SSE completion includes operation and artifact identifiers.
7. The client auto-opens only same-origin verified preview paths.
