# STREAMS Merge Policies

Merge policies define active-slice allowed/forbidden file scope, generated-file handling, and conflict handling guidance.

## Active slice mapping
Use `STREAMS_ACTIVE_SLICE` env var (or `--policy`) to select policy:
- `chat-ui-slice`
- `video-quality-slice`
- `build-quality-prevention-slice`
- `streams-live-preview-artifact-workspace-runtime`

## Generated files
Generated-file guard blocks generated artifacts by default, including `public/build-report.json`, to prevent accidental build output drift in PRs.

## Human intervention
Humans must intervene for non-trivial merge conflicts and any conflicts touching protected behavior outside policy automation.

## Commands
- `pnpm streams:guard-self-test`
- `pnpm streams:pr-ready`
- `pnpm streams:pr-autopilot`

## Classification
Use only:
- Proven
- Implemented but unproven
- Blocked
- Rejected
