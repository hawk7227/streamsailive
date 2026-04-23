# Streams Panel — Build Standard
## System prompt injection document. Load at the start of every session before touching any code.

---

## IDENTITY AND OPERATING CONTEXT

You are working on **StreamsAI** — an AI-powered content generation panel built on Next.js 16, Supabase, and fal.ai.

**Repo:** `github.com/hawk7227/streamsailive`
**Branch:** `main` (Vercel tracks this — nothing else)
**Local path:** `C:\Users\hawk7\streamsailive`
**Live URL:** `https://streamsailive.vercel.app/streams`
**HEAD:** `4df6d42`

Before touching any code in any session:
1. Run `cat BUILD_RULES.md FRONTEND_BUILD_RULES.md`
2. Read both files completely
3. Confirm you have read them
4. Run the audit script
5. Only then begin work

---

## SECTION 1 — PROJECT-SPECIFIC RULES

These rules are absolute. They apply to this project only and override general engineering preference.

**P.1 — Provider names appear in SettingsTab only.**
`fal-ai/`, `ElevenLabs`, `Kling`, `MiniMax`, `OpenAI`, `Runway`, `Veo`, `Scribe`, `Whisper` — none of these strings appear in any rendered UI outside SettingsTab. Everywhere else uses Streams brand names.

**P.2 — All model presets are baked in server-side. No exceptions.**
The following values are hardcoded in route handlers and are never user-configurable:
- OmniHuman: `guidance_scale: 1`, `audio_guidance_scale: 2`, `resolution: "720p"`
- ElevenLabs singing: `stability: 0.30`, no `speaker_boost`
- Sync Lipsync: segment must be ≤15s before submission
- MiniMax music: `prompt` field = STYLE ONLY, no lyrics
- ElevenLabs music: uses `sections[]` schema
- FFMPEG_COMPOSE = word-level edits. FFMPEG_MERGE = stitch only. Never swap these.

**P.3 — Design tokens are locked. No arbitrary values.**
Spacing: `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}` only.
Radius: `{8, 12, 16, 20, 24, 999}` only.
Shadows: `{0 4px 14px .06, 0 10px 30px .08, 0 18px 60px .10}` only.
Motion: `transform` and `opacity` only. Duration `150–220ms` only.
Font floor: `12px` minimum. Never below.

**P.4 — Persistence-first on all generation routes.**
DB write happens before fal submit. If the DB write fails, the fal call never fires. If fal accepts but DB write fails, we have a record. Reverse order is a structural failure.

**P.5 — All routes are auth-gated.**
Every `/api/streams/*` route verifies the user session and resolves the workspace before doing any work. No route skips auth.

**P.6 — No long-running operations in HTTP handlers.**
Any operation exceeding 25s goes to a background worker or is dequeued. The Vercel timeout is 30s. Operations that approach it belong off the HTTP path.

**P.7 — Rate limiting and cost enforcement are active on all generation routes.**
`checkRateLimit(workspaceId)` runs before every fal call. `cost_limit_daily_usd` is checked before video/generate. These are not optional.

**P.8 — Circuit breaker and retry are active in fal-client.**
`checkBreaker(endpoint)` runs before every `falSubmit`. `MAX_RETRIES = 3` with exponential backoff at `800ms` base. `recordSuccess` and `recordFailure` are called on every outcome.

**P.9 — Panel is standalone. No imports from other app systems.**
`src/components/streams/` and `src/app/api/streams/` import only from:
- `@/lib/env`
- `@/lib/supabase/server` and `@/lib/supabase/admin`
- `@/lib/team-server`
- `@/lib/streams/*`
No imports from `video-runtime`, `assistant-core`, `media-realism`, or any other app system.

**P.10 — GPT-4o Vision cannot produce timestamps. Scribe v2 only.**
Any route that needs word-level timestamps uses Scribe v2 via fal. GPT-4o Vision is for visual analysis only.

---

## SECTION 2 — APPROVED ARCHITECTURE DECISIONS

These decisions have been made and are locked. Do not re-litigate them.

**A.1 — Stack**
- Framework: Next.js 16 App Router
- Database: Supabase (Postgres + RLS + Storage)
- AI transport: fal.ai queue API (falSubmit / falPoll pattern)
- Voice: ElevenLabs v3
- Music: MiniMax v2.6 (primary), ElevenLabs sections[] (secondary)
- Video edit: Sync Lipsync v2 for lip sync, OmniHuman for full body
- Image: FLUX Kontext (primary)
- Transcript: Scribe v2 (word-level), GPT-4o Vision (visual analysis)
- Analyst: GPT-4o mini (pre-flight cost/quality)
- Deployment: Vercel (main branch)
- Storage: Supabase Storage (`generations` bucket, public, 500MB limit)

**A.2 — Panel structure**
Six tabs: Chat · Editor · Generate · Reference · Person · Settings
All tabs share state through `StreamsPanel.tsx` props:
`sharedVideoUrl`, `sharedAnalysisId`, `sharedGenLogId`, `sharedVoiceId`, `sharedPrompt`
Cross-tab wiring is prop drilling from StreamsPanel. No global state library.

**A.3 — API route pattern**
Every streams route:
1. Verifies auth (`createClient` → `getUser`)
2. Creates admin client (`createAdminClient`)
3. Resolves workspace (`getCurrentWorkspaceSelection`)
4. Validates request body (Zod or manual validation)
5. Checks rate limit (`checkRateLimit`)
6. Writes to DB (generation_log insert)
7. Submits to fal (`falSubmit`)
8. Returns `{ generationId, responseUrl }` for async jobs
9. Returns `{ outputUrl }` directly for sync jobs (Image, Voice, Music)

**A.4 — Polling pattern**
Async generation (T2V, I2V, Motion): client polls `/api/streams/video/status` every 6 seconds.
Sync generation (Image, Voice, Music): route returns `{ outputUrl }` directly. No polling. Client checks `data.outputUrl && !data.generationId` to distinguish.

**A.5 — Storage pattern**
Generated media: fal returns a temporary CDN URL. The status route re-uploads to Supabase `generations` bucket and stores the permanent URL in `generation_log.output_url`. Never store the raw fal URL as the permanent record.

**A.6 — Mobile layout pattern**
Mobile (`<768px`): single column, full width, controls above results.
Desktop (`≥768px`): two column, left panel fixed width, right grid `flex: 1`.
Results on mobile: bottom sheet or controls collapse. Never `display: none` on results.

**A.7 — Drawer pattern**
Mobile sidebar: `position: fixed`, `transform: translateX(-100%)` closed, `translateX(0)` open, `transition: transform 200ms ease`. Dark overlay `rgba(0,0,0,0.5)` behind it. Tap overlay to close.

**A.8 — Image quality**
FLUX Kontext: dimensions rounded to nearest 8px via `roundTo8`. No arbitrary dimensions.

**A.9 — Chat design**
No bubbles. No cards. No avatars. No borders on messages. User messages: right-aligned, `color: C.t1`. AI messages: left-aligned, flat prose. Separation by spacing only.

**A.10 — Cost tracking**
`generation_log.cost_usd` written from `result.cost.total_cost` in fal response on completion. Used to enforce `workspace_settings.cost_limit_daily_usd`. Shown in library as amber badge.

---

## SECTION 3 — CURRENT SYSTEM STATE

**Deployment**
- Live: `https://streamsailive.vercel.app/streams`
- HEAD: `4df6d42` — docs: Rule 12.4–12.10 — push verification loop mandatory
- Vercel: GREEN ✅ (as of last verified session)

**Database (Supabase — manual migrations confirmed run)**
Tables live:
- `generation_log` — one row per generation submission
- `workspace_settings` — per-workspace API keys and model defaults
- `person_analysis` — ingest pipeline output per person
- `reference_analyses` — GPT-4o Vision analysis results
- `video_versions` — edit chain with rollback support
- `bulk_jobs` — bulk generation jobs
- `bulk_job_items` — individual items within bulk jobs
- `share_links` — public share slugs
- `analyst_sessions` — Prompt Analyst GPT-4o mini sessions

Storage bucket: `generations` — PUBLIC, 500MB limit, 9 MIME types ✅

**Environment variables (confirmed set in Vercel)**
- `FAL_API_KEY` ✅
- `ELEVENLABS_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `NEXT_PUBLIC_SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

**API routes (24 — all implemented)**
```
video/generate          video/status            video/ingest
video/ingest/status     video/edit-voice        video/edit-voice/status
video/edit-motion       video/edit-motion/status video/edit-body
video/edit-emotion      video/dub               image/generate
voice/generate          music/generate          settings
settings/test-key       reference/analyze       library
stitch                  share                   analyst
bulk                    bulk/status             upload
```

**Infrastructure (implemented)**
- Rate limiter: `src/lib/streams/rate-limiter.ts` — sliding window 10/min, 50/hr
- Circuit breaker: `src/lib/streams/circuit-breaker.ts` — trips after 5 failures, 60s open
- fal-client: `src/lib/streams/fal-client.ts` — 3× retry, exponential backoff, breaker wired
- Cost enforcement: active on `video/generate`

**Infrastructure (NOT yet implemented)**
- Background worker (YouTube yt-dlp pipeline)
- Webhooks (client polling only — jobs orphan on tab close)
- Error tracking (Sentry not installed)
- Tests (zero test coverage)
- Staging environment (all changes go directly to production)

---

## SECTION 4 — ACTIVE TASKS

These are known open issues. Fix in order listed. Do not start new features until these are resolved.

**🔴 BLOCKER — Mobile: chat drawer broken**
`ChatTab` sidebar uses `display: none` on mobile. `sidebarOpen` state is set but never consumed in a `transform` rule. Tapping the hamburger on mobile does nothing visible.
Fix: Replace `display: none` with `position: fixed; transform: translateX(-100%)` closed, `translateX(0)` open. Add dark overlay. Wire `sidebarOpen` to both.

**🔴 BLOCKER — Mobile: grid hidden after generation**
`GenerateTab` CSS: `.streams-gen-right { display: none !important }` at `max-width: 768px`. Users generate content on mobile and see nothing.
Fix: Remove `display: none`. Implement bottom sheet — results slide up in a `translateY` sheet over the controls when generation completes.

**🔴 BLOCKER — Mobile: input obscured by keyboard**
`ChatTab` has no `visualViewport` listener. On iOS, the software keyboard covers the input field.
Fix: Add `window.visualViewport.addEventListener('resize', ...)` to offset the input container by `window.innerHeight - visualViewport.height`.

**🔴 TOKEN VIOLATION — Chat bubbles**
User messages still have `background: C.acc` filled pill. This is the cheap dev AI look. It violates Rule 4.1 and the premium standard.
Fix: Remove all background fill from user messages. Right-align, `color: C.t1`, no fill, no border, no border-radius.

**🔴 MISSING — No bottom sheet component exists**
Rule 1.3 requires results to be reachable on mobile. No bottom sheet implementation exists anywhere in the codebase.
Fix: Build a reusable `BottomSheet.tsx` component. `position: fixed; bottom: 0; width: 100%; transform: translateY(100%)` closed, `translateY(0)` open. Use in GenerateTab for results on mobile.

**🟠 UNVERIFIED — Bottom nav touch targets**
`StreamsPanel` bottom nav buttons need `min-height: 48px; min-width: 48px` confirmed. Visual inspection required.

---

## SECTION 5 — RELEVANT ARTIFACT SUMMARIES

**StreamsPanel.tsx** — Shell component. Renders the 6-tab nav (desktop top, mobile bottom). Manages cross-tab shared state: `sharedVideoUrl`, `sharedAnalysisId`, `sharedGenLogId`, `sharedVoiceId`, `sharedPrompt`. Wraps everything in `ToastProvider`.

**VideoPlayer.tsx (MediaPlayer)** — 4K-native media player. Auto-detects resolution. Controls: Space/J/K/L/F/M/P/,/./←/→. JKL shuttle scrub. Frame-step with `,` and `.`. PiP and fullscreen. Resolution badge. Shimmer skeleton on load. `currentWordMs` prop seeks to transcript word position.

**FileUpload.tsx** — XHR-based uploader with drag-drop. Real progress bar. Uploads to `/api/streams/upload` which returns a signed Supabase Storage URL. `compact` prop for inline use in forms.

**Toast.tsx** — `ToastProvider` context + `useToast` hook. Four variants: success/error/warn/info. Import `useToast` in any tab component.

**fal-client.ts** — Transport layer. `falSubmit` for queue submission (circuit breaker + 3× retry). `falPoll` for status polling. `extractVideoUrl`, `extractAudioUrl`, `extractImageUrl`, `extractMusicUrl` for result extraction. `FAL_ENDPOINTS` constant map of all 40+ endpoint strings.

**rate-limiter.ts** — Sliding window. 10 requests/minute, 50/hour per workspace. `checkRateLimit(workspaceId)` returns `{ allowed: true }` or `{ allowed: false, retryAfterMs, reason }`. In-memory — resets on cold start (known limitation).

**circuit-breaker.ts** — Trips after 5 failures within 60s window. 60s open period. `checkBreaker(endpoint)`, `recordSuccess(endpoint)`, `recordFailure(endpoint)`. Groups by top-level service path.

**GenerateTab.tsx** (1,144 lines) — 6 modes: T2V, I2V, Motion, Image, Voice, Music. Grid with progress bar, queue position, frame preview during generation. Bulk (1–12 parallel). Stitch via ffmpeg. Prompt Analyst. Real mic (getUserMedia 60s). Real cam (canvas frame capture). FileUpload for I2V start frame, Motion reference, Cover audio.

**VideoEditorTab.tsx** (622 lines) — 4 sub-tabs: Motion, Transcript, Audio, Export. Waveform timeline (3 tracks: VIDEO/VOICE/AMBIENT). Click-to-seek. Word chip bar → re-voice. SRT/VTT/motion-beats export. Voice selector (Cloned/Aria/Rachel/Adam).

**ChatTab.tsx** (566 lines) — Real SSE to `/api/ai-assistant`. Session history (msgHistoryRef). Library with lazy expand. Images nav. Inline attach URL input. Skeleton loaders. Mode chips (Chat/Image/Video/Build).

**PersonTab.tsx** (484 lines) — 8-step ingest pipeline (FileUpload → GPT-4o Vision → Scribe v2 → IVC voice clone → face analysis). 6 edit ops (voice, body, motion, dub, emotion, multishot). OmniHuman polling. Library picker for previously ingested videos.

**ReferenceTab.tsx** (359 lines) — Source options: Upload (FileUpload) / URL / YouTube (disabled). GPT-4o Vision analysis. Variation prompts → onSelectPrompt. Action buttons → real image/video routes. YouTube blocked with amber warning.

**SettingsTab.tsx** (323 lines) — API key inputs with hint masking. Live key validation (test-key route). Cost limits. Model defaults. Key clears on focus if showing hint.

---

## SECTION 6 — LATEST SESSION HANDOFF

**Last session completed:** Mobile audit, rule generation, rule file commits.

**What was done:**
- Full audit of all 6 tabs across desktop and mobile
- Identified and documented all UX violations
- Generated `BUILD_RULES.md` (12 sections, Rules 1–12)
- Generated `FRONTEND_BUILD_RULES.md` (17 sections, 172 rules, 80-item checklist)
- Added deployment verification loop (Rules 12.4–12.10)
- Confirmed both files committed and pushed to `main`
- HEAD confirmed green on Vercel at `4df6d42`

**What was NOT done (carry into next session):**
1. Mobile drawer — ChatTab sidebar broken on mobile (highest priority)
2. Mobile grid — GenerateTab results hidden on mobile
3. iOS keyboard — visualViewport listener missing in ChatTab
4. Chat bubbles — user message fill still present (token violation)
5. Bottom sheet — component does not exist, needed for mobile results
6. Timeline zoom — VideoEditorTab `timelineZoom` state may not be present

**Next session must start with:**
```bash
cat BUILD_RULES.md FRONTEND_BUILD_RULES.md
git log --oneline -3
git status
npx tsc --noEmit 2>&1 | grep "streams/" | grep "error TS"
```

Then fix the 6 active tasks in order listed in Section 4 before any other work.

**Deployment protocol for every push:**
```bash
git status                    # zero untracked imported files
git rev-parse --show-toplevel # correct repo root
git branch                    # on main
git remote -v                 # correct remote URL
npx tsc --noEmit              # zero streams/ errors
git add -A src/
git commit -m "..."
git push origin main
git log --oneline -3          # confirm commit landed
# Check Vercel dashboard — wait for Ready before moving on
# If Error — read build log, fix locally, push again
# Loop until Ready
```

---

## HARD STOPS

Stop immediately and fix before continuing if any of the following is true:

- `tsc --noEmit` returns errors in streams files
- Audit script returns findings
- Vercel shows Error on the latest push
- Any `display: none !important` is added to a feature-carrying element
- Any `setTimeout(() => setState("done"))` exists without a real operation
- Any `onClick={() => {}}` exists on a visible element
- Any provider name appears outside SettingsTab in rendered UI
- Any fontSize below 12 is introduced
- Any spacing value outside the locked scale is introduced
- Any new file is imported but not committed

---

*This document is the single source of truth for the Streams panel build. It supersedes any verbal instruction given earlier in a session. If something is not in this document or in BUILD_RULES.md or FRONTEND_BUILD_RULES.md, use engineering judgement consistent with the premium, mobile-first, no-stubs standard described throughout.*
