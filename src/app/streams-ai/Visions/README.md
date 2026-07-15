# Streams Visions isolation contract

`/streams-ai/Visions` is a separate visual-conversation surface.

- It owns its client, API namespace, prompt, browser keys, events, CSS scope and persistence tables.
- It does not import the current Streams chat runtime or alter `/streams-ai`.
- `STREAMS_VISIONS_ENABLED=false` disables this route and its APIs without affecting Streams AI.
- The only shared modules are low-level platform infrastructure such as the generic Supabase server client.
- The production database must apply `20260714_streams_visions_isolated.sql` before the route is used.
