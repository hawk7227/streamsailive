# Admin Generation provider keys wired

Confirmed provider env names now recognized by the admin generation runtime:

- `RUNWAY_API_KEY` — direct Runway video provider adapter.
- `KLING_API_KEY` — supported as Kling secret key. Kling also requires an access key through `KLING_ACCESS_KEY` or legacy `KLING_ASSESS_API_KEY`.
- `VEO_API_KEY` — direct Veo provider adapter. A production Veo gateway endpoint must be supplied as `VEO_GENERATION_ENDPOINT`; polling uses optional `VEO_STATUS_ENDPOINT` with `{id}` placeholder.
- `ELEVENLABS_API_KEY` — voice/audio generation provider.

The video runtime now routes provider=`veo` to the Veo adapter instead of silently converting it to fal.ai. Runway, Kling, and Veo jobs are submitted through provider-specific backend adapters, then polled and stored through the same artifact pipeline used by long-form generation and stitching.

Kling note: the Kling API uses an access key and secret key pair. This patch supports either:

- `KLING_ACCESS_KEY` + `KLING_SECRET_KEY`, or
- `KLING_ASSESS_API_KEY` + `KLING_API_KEY`.

If only `KLING_API_KEY` is set, the backend will fail truthfully and report the missing access key instead of pretending the provider is wired.
