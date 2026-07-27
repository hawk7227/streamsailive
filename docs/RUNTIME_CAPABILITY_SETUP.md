# Streams runtime capability setup

This document configures the production environment without committing secrets to GitHub.

## Safety rules

- Add secret values only in Vercel Project Settings → Environment Variables or through an authenticated `vercel env add` session.
- Never commit `.env`, tokens, provider keys, Supabase service-role keys, or encryption keys.
- Apply secrets to Production and Preview only when the corresponding environment needs the capability.
- Redeploy after changing environment variables.
- Verify with `GET /api/streams-builder/env-readiness`. The response reports variable names and readiness states, never secret values.

## Required configuration

### Core chat and Supabase

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must remain server-side. Never prefix it with `NEXT_PUBLIC_`.

### Builder credentials and repair loop

- `STREAMS_CREDENTIAL_KEY`
- `CONNECTOR_ENCRYPTION_KEY`

Generate independent high-entropy values. Example commands to run locally:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

Do not reuse the same value for both variables.

### GitHub and Vercel execution

- `GITHUB_TOKEN` or `GH_TOKEN`
- `VERCEL_TOKEN`

GitHub token permissions should be limited to the repositories Streams must operate on. Required access normally includes repository contents and metadata; add pull-request/workflow permissions only when those features are used.

The Vercel token must belong to an account or team with access to the Streams project.

### Image and video providers

- `FAL_API_KEY` or `FAL_KEY`
- `RUNWAY_API_KEY`
- `KLING_API_KEY`
- `VEO_API_KEY`

Optional:

- `KLING_ASSESS_API_KEY`
- `OPENAI_API_KEY_IMAGES`
- `OPENAI_IMAGE_MODEL`

Only configure providers for which Streams has an active account and approved API access.

### Voice

- `ELEVENLABS_API_KEY`
- `OPENAI_API_KEY_VOICE` or the core `OPENAI_API_KEY`

### Admin generation jobs

- `ADMIN_GENERATION_KEY`

Generate this as a separate high-entropy secret.

## Persistent workspace writes

`STREAMS_PERSISTENT_WORKSPACE_ROOT` must point to a durable filesystem owned by a long-running Builder worker.

Do not treat Vercel Function local storage as durable. `/tmp` and other local paths are ephemeral and may disappear between invocations. For production-grade workspace writes, deploy the Builder execution worker on infrastructure with a persistent mounted volume, then set this variable in that worker environment, for example:

```text
STREAMS_PERSISTENT_WORKSPACE_ROOT=/var/lib/streams/workspaces
```

The directory must:

- exist or be creatable by the worker process;
- be writable by the worker user;
- persist across restarts and deployments;
- be excluded from public static serving;
- have backups or source-control synchronization appropriate to the project.

GitHub API edits can operate independently of this local workspace, but local read/write/command tools require the durable worker root.

## Vercel CLI workflow

Run from a trusted local machine already linked to the correct Vercel project:

```bash
vercel link
vercel env add OPENAI_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STREAMS_CREDENTIAL_KEY production
vercel env add CONNECTOR_ENCRYPTION_KEY production
vercel env add GITHUB_TOKEN production
vercel env add VERCEL_TOKEN production
vercel env add FAL_API_KEY production
vercel env add RUNWAY_API_KEY production
vercel env add KLING_API_KEY production
vercel env add VEO_API_KEY production
vercel env add ELEVENLABS_API_KEY production
vercel env add ADMIN_GENERATION_KEY production
```

Repeat for `preview` only when preview deployments need the same capability. Avoid adding production provider keys to development environments unnecessarily.

Redeploy after configuration:

```bash
vercel --prod
```

## Verification

After deployment, request:

```text
GET /api/streams-builder/env-readiness
```

Expected capability groups include:

- `chat-core`
- `chat-uploads`
- `supabase-core`
- `workspace-writes`
- `builder-credentials`
- `builder-repair-loop`
- `builder-github`
- `builder-vercel`
- `builder-proof`
- OpenAI/fal image generation
- Runway/Kling/Veo video generation
- ElevenLabs/OpenAI voice generation

A capability is usable only when its readiness state is `ready` or an intentionally accepted `partial` state. Investigate every `missing` entry before claiming the capability is operational.

## Functional smoke tests

Environment presence alone is not proof. After readiness passes, run one non-destructive test per capability:

1. Chat: send a normal conversational message and verify a persisted response.
2. Supabase: upload a small text file and retrieve it in the same conversation.
3. GitHub: list an authorized repository and read one file without changing it.
4. Builder writes: create and delete a disposable file inside a test workspace on the persistent worker.
5. Builder repair: run a harmless failing test fixture, confirm diagnosis, then repair and rerun.
6. Vercel: read deployment status for the current commit without triggering a deployment.
7. Image: generate one low-cost test image and verify the artifact record and URL.
8. Video providers: submit the smallest supported test job separately to fal, Runway, Kling, and Veo; verify job polling and final artifact persistence.
9. Voice: synthesize a short sentence with each configured provider and verify the stored audio artifact.

Do not mark a provider operational merely because its key exists. Require a successful provider response, persisted job state, and artifact or deployment evidence.
