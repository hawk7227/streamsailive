# Streams Panel — Project Brief
## Load this at the start of every session. Read completely before writing a single line of code.

---

## 1. SYSTEM IDENTITY

**What this is:**
StreamsAI is a standalone AI content generation panel — video, image, voice, and music — built inside a Next.js 16 application. It is accessed at `/streams` and is fully isolated from the rest of the application. It is not a dashboard feature. It is not a sidebar widget. It is a full creative studio.

**Who uses it:**
Content creators, marketers, and media teams who need to generate, edit, and publish AI-generated video, image, voice, and music without switching between multiple tools.

**The standard it is built to:**
Apple-class. Runway Gen 4 is the competitive benchmark. Every surface is mobile-first, premium-only, no stubs, no fakes, no cheap dev patterns. The rules in `BUILD_RULES.md` and `FRONTEND_BUILD_RULES.md` are hard gates on every push.

**Repository:**
- GitHub: `github.com/hawk7227/streamsailive`
- Branch: `main` — Vercel tracks this exclusively
- Local: `C:\Users\hawk7\streamsailive`
- Live: `https://streamsailive.vercel.app/streams`
- HEAD at last session: `590761e`

**Stack:**
- Framework: Next.js 16 App Router
- Database: Supabase (Postgres + RLS + Storage)
- AI transport: fal.ai queue API
- Voice: ElevenLabs v3
- Music: MiniMax v2.6 primary, ElevenLabs sections[] secondary
- Video edit: Sync Lipsync v2, OmniHuman full-body
- Image: FLUX Kontext
- Transcript: Scribe v2 (word-level), GPT-4o Vision (visual analysis)
- Analyst: GPT-4o mini pre-flight
- Deployment: Vercel
- Storage: Supabase Storage — `generations` bucket, public, 500MB

---

## 2. WHAT ALREADY EXISTS

### Panel Shell
`src/components/streams/StreamsPanel.tsx`
Six-tab navigation shell. Desktop: top nav. Mobile: bottom nav with 48×48 touch targets (confirmed). Cross-tab shared state props: `sharedVideoUrl`, `sharedAnalysisId`, `sharedGenLogId`, `sharedVoiceId`, `sharedPrompt`. Wraps everything in `ToastProvider`.

### Tabs (all six implemented)
| Tab | File | Lines | Status |
|---|---|---|---|
| Chat | `ChatTab.tsx` | 565 | ⚠️ Broken on mobile (see Section 8) |
| Editor | `VideoEditorTab.tsx` | 621 | ✅ Functional — timeline zoom present |
| Generate | `GenerateTab.tsx` | 1,143 | ⚠️ Grid hidden on mobile |
| Reference | `ReferenceTab.tsx` | 358 | ✅ Functional |
| Person | `PersonTab.tsx` | 483 | ✅ Functional |
| Settings | `SettingsTab.tsx` | 322 | ✅ Functional |

### Components
- `VideoPlayer.tsx` — 4K-native, JKL scrub, frame step, PiP, fullscreen, resolution badge, `currentWordMs` seek
- `FileUpload.tsx` — XHR progress, drag-drop, signed Supabase URL
- `Toast.tsx` — `ToastProvider` + `useToast` hook, 4 variants

### Infrastructure
- `src/lib/streams/fal-client.ts` — `falSubmit` / `falPoll`, circuit breaker wired, 3× retry with exponential backoff at 800ms base, `recordSuccess` / `recordFailure` on every outcome
- `src/lib/streams/rate-limiter.ts` — File exists, 10/min + 50/hr sliding window per workspace. **NOT imported into any route yet** (see Section 8)
- `src/lib/streams/circuit-breaker.ts` — File exists, wired into fal-client ✅

### API Routes (24 — all implemented and green)
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

### Database (confirmed live in Supabase)
Tables: `generation_log`, `workspace_settings`, `person_analysis`, `reference_analyses`, `video_versions`, `bulk_jobs`, `bulk_job_items`, `share_links`, `analyst_sessions`
Storage bucket: `generations` — public, 500MB, 9 MIME types

### Environment Variables (confirmed set in Vercel)
`FAL_API_KEY` ✅ `ELEVENLABS_API_KEY` ✅ `OPENAI_API_KEY` ✅ `NEXT_PUBLIC_SUPABASE_URL` ✅ `SUPABASE_SERVICE_ROLE_KEY` ✅

### Rule Files (in repo root)
- `BUILD_RULES.md` — 12 sections, Rules 1–12, audit checklist
- `FRONTEND_BUILD_RULES.md` — 17 sections, 172 rules, 80-item checklist
- `STREAMS_BUILD_STANDARD.md` — Full session injection document

---

## 3. WHAT MUST STAY

These decisions are locked. Do not change, refactor, remove, or re-litigate any of them.

**Architecture**
- Panel is completely isolated. `src/components/streams/` and `src/app/api/streams/` import only from `@/lib/env`, `@/lib/supabase/*`, `@/lib/team-server`, and `@/lib/streams/*`. No imports from any other app system.
- Cross-tab state lives in `StreamsPanel.tsx` as props. No global state library.
- Six tabs. No new tabs without explicit decision.
- Mobile bottom nav. Desktop top nav. Both stay.

**API Route Pattern (every route follows this order)**
1. Verify auth
2. Create admin client
3. Resolve workspace
4. Validate request body
5. Check rate limit
6. Write to DB (before fal call)
7. Submit to fal
8. Return response

**Polling pattern**
- Async jobs (T2V, I2V, Motion): client polls `/video/status` every 6 seconds
- Sync jobs (Image, Voice, Music): route returns `{ outputUrl }` directly. Client checks `data.outputUrl && !data.generationId`

**Baked presets (never user-configurable)**
- OmniHuman: `guidance_scale: 1`, `audio_guidance_scale: 2`, `resolution: "720p"`
- ElevenLabs singing: `stability: 0.30`, no `speaker_boost`
- Sync Lipsync: segment ≤15s before submission
- MiniMax music: `prompt` = STYLE ONLY, no lyrics
- ElevenLabs music: `sections[]` schema
- FFMPEG_COMPOSE = word edits. FFMPEG_MERGE = stitch only.

**Design tokens (never change)**
- Spacing: `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}` only
- Radius: `{8, 12, 16, 20, 24, 999}` only
- Motion: `transform` and `opacity` only, `150–220ms`
- Font floor: `12px` minimum, never below
- Shadow scale: `{0 4px 14px .06, 0 10px 30px .08, 0 18px 60px .10}`

**Provider names**
- Never appear in rendered UI outside SettingsTab
- Everywhere else uses Streams brand language only

**Storage pattern**
- fal temporary URL → re-upload to Supabase `generations` bucket → store permanent URL in `generation_log.output_url`
- Never store the raw fal URL as the permanent record

**Persistence-first**
- DB write always happens before fal submit
- If DB write fails, fal call never fires

---

## 4. FINAL TARGET STATE

When this project is complete, every item below is true without exception.

**Mobile**
- [ ] ChatTab sidebar opens as a real drawer (transform, overlay, tap-to-close)
- [ ] GenerateTab grid results visible on mobile (bottom sheet rises over controls)
- [ ] ChatTab input stays above iOS keyboard at all times (visualViewport listener)
- [ ] Bottom sheet component exists and is reused across tabs
- [ ] No `display: none !important` on any feature-carrying element at any breakpoint

**Chat**
- [ ] Zero chat bubbles — user messages are right-aligned flat text, no fill
- [ ] Zero AI message cards — left-aligned flat prose, no border, no background
- [ ] Zero avatars — no `U` circle, no `S` circle, no initials anywhere
- [ ] Zero "Streams, now" labels — timestamps only, muted colour

**Infrastructure**
- [ ] Rate limiter imported and active in all generation routes (not just the file existing)
- [ ] Cost enforcement active on all generation routes (currently only video/generate)

**All tabs**
- [ ] Every empty state has a label and a primary action — no dark voids
- [ ] Every interactive element ≥ 44×44px
- [ ] All media controls reachable without hover on mobile
- [ ] No stubs, no fakes, no `setTimeout` masking missing functionality

**Deployment**
- [ ] Every push verified green on Vercel before next work begins
- [ ] `tsc --noEmit` on streams files = 0 errors before every push
- [ ] Audit script = 0 findings before every push

---

## 5. NON-NEGOTIABLE RULES

These are not guidelines. Any violation blocks the push.

**Hard stops — stop and fix before writing another line:**
- `tsc --noEmit` returns errors in streams files
- Audit script returns any finding
- Vercel shows Error on latest push
- `display: none !important` added to a feature-carrying element
- `setTimeout(() => setState("done"))` without a real operation behind it
- `onClick={() => {}}` on any visible element
- Provider name in rendered UI outside SettingsTab
- `fontSize` below 12
- Spacing value outside `{4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96}`
- New file imported but not committed to git
- Chat bubble (any background fill on user or AI message text)
- Avatar circle next to any message

**Process rules — apply every session:**
- Read `BUILD_RULES.md` and `FRONTEND_BUILD_RULES.md` before touching any code
- Run `git status` before every push — zero untracked imported files
- Run `git rev-parse --show-toplevel` — correct repo root
- Run `git branch` — must show `main`
- Run `git remote -v` — must show `hawk7227/streamsailive`
- Run `git log --oneline -3` after every push — confirm commit landed
- Check Vercel — wait for Ready before moving on

---

## 6. PROOF STANDARD

A fix is not done when the code is written. A fix is done when all of the following pass.

**For every fix:**
```bash
npx tsc --noEmit 2>&1 | grep "streams/" | grep "error TS"
# Must return: empty (zero errors)
```

**Pattern audit (run this exact script):**
```python
import os, re, subprocess
src = "/path/to/src/"
findings = []

# Stubs
STUBS = [r'setTimeout.*set\w+State.*"done"', r'onClick=\{[^}]*\{\}\}', r'window\.prompt\(']
for name, path in ALL_TABS.items():
    c = open(src + path).read()
    for p in STUBS:
        if re.search(p, c):
            findings.append(f"STUB|{name}: {p}")

# Font floor
for name, path in ALL.items():
    bad = {int(m) for m in re.findall(r'fontSize:\s*(\d+)', open(src+path).read()) if int(m) < 12}
    if bad: findings.append(f"FONT|{name}: {bad}")

# Token spacing
VALID = {0,1,2,3,4,6,8,12,16,20,24,32,40,48,64,80,96,100}
for name, path in ALL.items():
    bad = {int(m) for m in re.findall(r'padding:\s*"(\d+)px', open(src+path).read()) if int(m) not in VALID}
    if bad: findings.append(f"TOKEN|{name}: {bad}px")

print(f"{len(findings)} findings")  # Must be: 0 findings
```

**For mobile fixes specifically:**
- Screenshot at 390px width in Chrome DevTools confirms the fix is visible
- Drawer opens and closes with transform animation confirmed visually
- Input stays above keyboard confirmed on iOS or iOS simulator

**For chat bubble fix:**
- Grep confirms no `background: C.acc` or `background: C.surf` on message containers
- `border` attribute absent from all message wrappers
- Avatar divs removed from DOM entirely

**For deployment:**
```bash
git log --oneline -3  # Commit hash matches what was just pushed
# Vercel dashboard: latest deployment shows "Ready"
```

---

## 7. (Reserved for future section)

---

## 8. CURRENT COVERAGE VS GAPS

### What is fully working ✅

| Area | Status | Evidence |
|---|---|---|
| All 24 API routes | ✅ Live | All route files present, 200+ lines each |
| fal-client transport | ✅ | falSubmit, falPoll, extractors all present |
| Circuit breaker | ✅ | Wired into fal-client — checkBreaker before every submit |
| 3× retry with backoff | ✅ | MAX_RETRIES=3, 800ms base in fal-client |
| Cost enforcement | ✅ | video/generate reads cost_limit_daily_usd, returns 402 |
| DB persistence-first | ✅ | generation_log insert before falSubmit in all routes |
| Supabase migrations | ✅ | 9 tables confirmed live |
| Storage bucket | ✅ | generations bucket, public, 500MB confirmed |
| Env vars | ✅ | FAL_API_KEY, ELEVENLABS_API_KEY, OPENAI_API_KEY confirmed in Vercel |
| VideoPlayer 4K | ✅ | Native resolution, JKL scrub, frame step, PiP, fullscreen |
| FileUpload XHR | ✅ | Real progress, drag-drop, signed URL |
| Toast system | ✅ | ToastProvider, useToast, 4 variants |
| GenerateTab 6 modes | ✅ | T2V, I2V, Motion, Image, Voice, Music all functional |
| GenerateTab FileUpload | ✅ | I2V start frame, Motion reference, Cover audio |
| GenerateTab sliders | ✅ | Stability + speed controlled (value + onChange) |
| GenerateTab direct-URL | ✅ | Image/Voice/Music return outputUrl, no polling loop |
| GenerateTab progress | ✅ | Progress bar, queue position, frame preview during gen |
| GenerateTab stitch | ✅ | MediaPlayer result, clip count |
| GenerateTab bulk | ✅ | 1–12 parallel, wired to /api/streams/bulk |
| GenerateTab analyst | ✅ | Wired to /api/streams/analyst |
| VideoEditorTab waveform | ✅ | 60-bar, 3 tracks, click-to-seek, playhead |
| VideoEditorTab zoom | ✅ | timelineZoom state present, 1×–8× |
| VideoEditorTab SRT/VTT | ✅ | Real serializer from transcript state |
| VideoEditorTab voice selector | ✅ | voiceChoice state, wired to re-voice |
| ChatTab SSE streaming | ✅ | Real SSE to /api/ai-assistant |
| ChatTab session history | ✅ | msgHistoryRef preserves messages |
| ChatTab lazy library | ✅ | expandedLib — Preview button to expand |
| ChatTab Images nav | ✅ | Renders image-type library items |
| ChatTab attach | ✅ | Inline URL input (attachMode state) |
| PersonTab ingest | ✅ | 8-step pipeline, FileUpload, OmniHuman poll |
| PersonTab bodyMap | ✅ | srcVideo wired into all 6 edit ops |
| ReferenceTab FileUpload | ✅ | Upload source, variation prompts wired |
| ReferenceTab actions | ✅ | Real routes — /api/streams/image/generate |
| ReferenceTab YouTube | ✅ | Disabled with amber warning |
| SettingsTab cost save | ✅ | parseFloat(daily), model defaults saved |
| SettingsTab key clear | ✅ | Clears hint on focus |
| Bottom nav touch targets | ✅ | minWidth: 48, minHeight: 48 confirmed |
| ignoreBuildErrors | ✅ | next.config.ts suppresses legacy non-streams errors |
| Rule files committed | ✅ | BUILD_RULES.md, FRONTEND_BUILD_RULES.md, STREAMS_BUILD_STANDARD.md |

---

### What is broken or missing 🔴

| # | Issue | File | Exact Problem | Rule Violated |
|---|---|---|---|---|
| 1 | Drawer broken on mobile | `ChatTab.tsx:556` | `.streams-chat-sidebar { display: none !important }` — sidebarOpen state is set but never consumed in a transform rule. Tapping hamburger on mobile does nothing. | Rule 2.1, Rule 2.2 |
| 2 | Grid hidden on mobile | `GenerateTab.tsx:1138` | `.streams-gen-right { display:none !important }` at max-width:768px. Users generate content and see nothing on mobile. | Rule 1.2, Rule 1.3 |
| 3 | Input obscured by keyboard | `ChatTab.tsx` | No `visualViewport` listener anywhere in ChatTab. iOS keyboard covers the input field. | Rule 3.1 |
| 4 | Chat bubbles | `ChatTab.tsx:407` | `background: msg.role === "user" ? C.acc : C.surf` on the message wrapper div. User messages: filled purple pill. AI messages: bordered surface card. Both wrong. | Rule 4.1, Rule 4.2 |
| 5 | Avatars in chat | `ChatTab.tsx:390` | 28px circle with `U` / `S` initials next to every message. `background: msg.role === "user" ? C.bg4 : C.acc`. | Rule 4.3 |
| 6 | "Streams, now" label | `ChatTab.tsx:400` | `"Streams, now"` rendered above every AI message. | Rule 4.4 |
| 7 | No bottom sheet | Nowhere | No `BottomSheet` component exists. Required for mobile results in GenerateTab and any future mobile overflow pattern. | Rule 1.3 |
| 8 | Rate limiter not wired | All routes except cost check | `rate-limiter.ts` exists but is imported nowhere. `checkRateLimit` is never called. The file is dead code. | Rule 12.3 (infra audit) |
| 9 | Cost enforcement only on video | `video/generate` only | `cost_limit_daily_usd` check exists in video/generate. Missing from: image/generate, voice/generate, music/generate, bulk. | Infra standard |

---

## 9. BUILD-ORDER MATRIX

Fix in this exact order. Do not skip. Do not reorder. Do not start a new item until the previous one is green on Vercel.

| Order | Fix | File(s) | What to do | Done when |
|---|---|---|---|---|
| **1** | Remove avatars and "Streams, now" label | `ChatTab.tsx` | Delete the 28px avatar div entirely from the message renderer. Delete the `"Streams, now"` label div. These are the simplest removals with zero risk of breaking other functionality. | No avatar circle in DOM at any message. No "Streams, now" text rendered. |
| **2** | Remove chat bubbles | `ChatTab.tsx` | Remove `background`, `border`, and `borderRadius` from the message wrapper div. User messages: `textAlign: "right"`, `color: C.t1`, nothing else. AI messages: `textAlign: "left"`, `color: C.t1`, nothing else. Spacing between messages is the only separator. | `background: C.acc` and `background: C.surf` absent from all message containers. No borders on message wrappers. |
| **3** | Wire visualViewport listener | `ChatTab.tsx` | Add `useEffect` on mount that attaches `window.visualViewport.addEventListener('resize', handler)`. Handler calculates `offset = window.innerHeight - visualViewport.height` and applies `translateY(-offset)` to the input container ref. Remove on unmount. | `visualViewport` string present in ChatTab source. Manual iOS test confirms input stays above keyboard. |
| **4** | Build BottomSheet component | `src/components/streams/BottomSheet.tsx` | New component. `position: fixed; bottom: 0; left: 0; right: 0`. `transform: translateY(100%)` closed, `translateY(0)` open. `transition: transform 200ms cubic-bezier(.4,0,.2,1)`. Dark overlay `rgba(0,0,0,0.5)`. Drag handle at top. `onClose` prop. `children` renders inside. Respects `env(safe-area-inset-bottom)` on padding. | Component renders and animates correctly at 390px. Closes on overlay tap and drag handle tap. |
| **5** | Fix GenerateTab mobile — results via BottomSheet | `GenerateTab.tsx` | Remove `.streams-gen-right { display:none !important }` from the mobile CSS block. Add state: `const [resultsOpen, setResultsOpen] = useState(false)`. When generation completes on mobile (`window.innerWidth < 768`), call `setResultsOpen(true)`. Wrap grid in `<BottomSheet open={resultsOpen} onClose={() => setResultsOpen(false)}>`. Desktop layout unchanged. | At 390px, Generate button triggers generation, grid results appear in bottom sheet. `display:none` absent from codebase. |
| **6** | Fix ChatTab drawer — real transform | `ChatTab.tsx` | Remove `.streams-chat-sidebar { display: none !important }`. Replace with: sidebar renders always, `position: fixed; top: 0; left: 0; height: 100%; width: 280px; transform: translateX(-100%); transition: transform 200ms ease; z-index: 300`. When `sidebarOpen === true`: `transform: translateX(0)`. Add overlay div: `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 299; opacity: sidebarOpen ? 1 : 0; pointerEvents: sidebarOpen ? "auto" : "none"`. Overlay onClick calls `setSidebar(false)`. | Hamburger tap on mobile opens drawer with slide animation. Overlay appears. Tapping overlay closes drawer. No `display:none` on sidebar. |
| **7** | Wire rate limiter into all generation routes | `image/generate`, `voice/generate`, `music/generate`, `bulk` | Add `import { checkRateLimit } from "@/lib/streams/rate-limiter"` to each route. Call `checkRateLimit(workspaceId)` before `falSubmit`. Return 429 with `Retry-After` header if not allowed. Pattern matches what already exists in `video/generate` cost check. | `checkRateLimit` imported and called in all 5 generation routes. Rate limit test: 11 rapid requests to any generation route returns 429 on the 11th. |
| **8** | Wire cost enforcement to remaining routes | `image/generate`, `voice/generate`, `music/generate`, `bulk` | Copy the cost enforcement block from `video/generate` (reads `workspace_settings.cost_limit_daily_usd`, sums today's `generation_log.cost_usd`, returns 402 if over limit) into each remaining generation route. | `cost_limit_daily_usd` check present in all 5 generation routes. |

---

### Per-fix verification gate

Before marking any item done and moving to the next:

```bash
# 1. Type check
npx tsc --noEmit 2>&1 | grep "streams/" | grep "error TS"
# Expected: empty output

# 2. Audit
python3 scripts/audit.py
# Expected: 0 findings

# 3. Commit
git status          # zero untracked imported files
git branch          # main
git remote -v       # hawk7227/streamsailive
git add -A src/
git commit -m "fix(streams): [description of fix]"
git push origin main
git log --oneline -3  # confirm commit hash landed

# 4. Vercel
# Check dashboard — wait for Ready
# If Error: read full build log, fix locally, push again, wait for Ready
# Do not start next item until Ready
```

---

## SESSION START COMMANDS

Run these at the start of every session before touching any code:

```bash
cat BUILD_RULES.md FRONTEND_BUILD_RULES.md STREAMS_BUILD_STANDARD.md
git log --oneline -5
git status
npx tsc --noEmit 2>&1 | grep "streams/" | grep "error TS"
```

Confirm:
- Both rule files read completely
- HEAD matches last known good commit
- No uncommitted changes from a previous session
- Zero type errors in streams files

Then begin at the lowest-numbered incomplete item in Section 9.
