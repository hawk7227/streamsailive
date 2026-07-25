# StreamsAI small fixes

These files contain the two narrowly scoped fixes requested.

## Fix 1: project authentication

Files:

- `project-auth-client-fix.ts`
- `project-auth-server-fix.ts`

Apply the client helper to the component that sends `POST /api/v1/projects`.

Important behavior:

- Do not call `supabase.auth.refreshSession()` after `getSession()` returns null.
- Send `credentials: "include"`.
- Attach `Authorization` only when an access token is already available.
- Let the API authenticate from Supabase SSR cookies when the header is absent.
- Return HTTP 401 for a genuinely unauthenticated request instead of HTTP 500.

The exact repository path was unavailable while the GitHub connector was failing,
so these are patch-ready replacement helpers rather than blind full-file replacements.

## Fix 2: OpenAI FILES_GENERATING retry

File:

- `openai-files-generating-retry-fix.ts`

Wrap only the OpenAI call used by the `FILES_GENERATING` stage.

It retries:

- 429
- 500
- 502
- 503
- 504
- provider errors with `type: "server_error"`

Default timing:

- initial request
- retry after 1 second
- retry after 2 seconds
- retry after 4 seconds

It also changes malformed provider codes such as `"{\n  \"error\""` into stable
codes such as `openai_server_error`, and preserves the OpenAI request ID.

## Build commands

After integrating the helpers:

```bash
pnpm test:streams-ai-production
pnpm test:architecture
pnpm build
```
