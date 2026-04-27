# COMPLETE BUILD PLAN — ALL FEATURES DISCUSSED TODAY
## Consolidated Requirements + Phased Implementation

---

## WHAT WE'RE KEEPING (ZERO REMOVALS)

✅ All existing endpoints (Image, T2V, I2V, Motion, Voice, Music, Bulk)
✅ All existing state variables (30+)
✅ All existing UI components (Topbar, Mode strip, Prompt card, Output card, Bulk grid)
✅ All existing functions (handleGenerate, runAnalyst, polling)
✅ New GenerateTab layout (100% viewport fit, no scroll)
✅ Mode image strip (110px fixed)
✅ Music sub-tabs (conditional)
✅ Prompt card (240px fixed)
✅ Output + Bulk sections (scrollable)

---

## CONSOLIDATED FEATURE LIST (Today's Discussion)

### 1. VIDEO ANALYSIS WORKFLOW (Complete)
- ✅ Video URL input + platform detection (YouTube/TikTok/Facebook/Instagram)
- ✅ Embed iframes + screen recording fallback
- ✅ Frame extraction (hybrid: ffmpeg.wasm preview + backend full)
- ✅ Video duplication analysis (NOT just description)
- ✅ Analyst chat (multi-turn conversation)
- ✅ Upload reference + auto-analyze
- ✅ Editable analysis results
- ✅ "Use This Prompt" button

### 2. ADVANCED PLAYER OPTIONS (Optional, Phased)
- ⏳ Timeline with start/end selection
- ⏳ Frame preview grid (see what will be analyzed)
- ⏳ Playback speed controls (0.25x to 2x)
- ⏳ Frame-by-frame navigation
- ⏳ Segment markers (label intro/dance/outro)
- ⏳ Auto key frame detection (optional advanced)
- ⏳ OBS fallback option (optional for power users)

### 3. VIDEO THUMBNAIL SELECTION (For All Video Modes)
- ✅ Timeline slider to pick frame
- ✅ Preview thumbnail updates as slider moves
- ✅ "Use as Thumbnail" button
- ✅ Works for T2V, I2V, Motion generated videos
- ✅ Works for uploaded reference videos

### 4. GENERATION STATUS INDICATORS (All 7 Types)
- ✅ Spinner icon during polling
- ✅ Status text (mode-specific messages)
- ✅ Time estimate ("Est. 15 seconds")
- ✅ Cancel button (while generating)
- ✅ Cost display ("$0.08")
- ✅ Bulk grid per-item status badges (⟳/✅/❌/⏳)
- ✅ Progress counter ("2 of 5 complete")

### 5. PERSISTENT BACKGROUND GENERATIONS (Non-Blocking)
- ✅ New database tables (generation_jobs, bulk_jobs)
- ✅ 7 new backend endpoints (create, check-status, resume, cancel, etc)
- ✅ Frontend persistence manager (resume on app load)
- ✅ localStorage backup (emergency fallback)
- ✅ Survive page refresh, browser close, session restart
- ✅ Multi-concurrent generations (start A, then B, then C)
- ✅ Non-blocking UI (don't wait for completion)

### 6. GENERATION TYPE-SPECIFIC FEATURES
**Image:**
- Thumbnail selection (from multi-image generation)

**T2V:**
- Thumbnail selection + Aspect ratio preview

**I2V:**
- Thumbnail selection + Reference image preview

**Motion:**
- Thumbnail selection + Motion preview + Reference preview + Side-by-side

**Voice:**
- Voice sample playback + Stability controls + Speed adjustment

**Music:**
- BPM control + Duration selection + Lyric preview

**Bulk:**
- Per-item retry + Multi-prompt support + Cancel all + Export ZIP

---

## PHASED IMPLEMENTATION PLAN

### PHASE 0: Foundational (Week 1-2)
**MUST DO FIRST — Everything else depends on this**

Backend:
- [ ] Add generation_jobs table
- [ ] Add bulk_jobs table
- [ ] Create POST /api/streams/generate-job (create job, return immediately)
- [ ] Create GET /api/streams/generation-job/:id (check status)
- [ ] Create POST /api/streams/bulk-job (create bulk)
- [ ] Create GET /api/streams/bulk-job/:id (check bulk status)
- [ ] Create GET /api/streams/my-generations (resume session)
- [ ] Create POST /api/streams/generation-job/:id/cancel
- [ ] Create POST /api/streams/bulk-job/:id/cancel-all
- [ ] Add background polling daemon (checks all jobs every 30s)

Frontend:
- [ ] PersistentGenerationManager (resume on app load)
- [ ] localStorage backup
- [ ] Query my-generations on app load
- [ ] Resume polling for active jobs
- [ ] Update state from database jobs

Result: **Generations survive refresh/restart, non-blocking UI foundation**

---

### PHASE 1: Generation Status Indicators (Week 3)
**HIGH PRIORITY — Required for all 7 types**

Frontend (GenerateTab.tsx):
- [ ] Add spinner animation (CSS)
- [ ] Show status text during polling (mode-specific messages)
- [ ] Show time estimate ("Est. 15 seconds")
- [ ] Add Cancel button (while polling)
- [ ] Show cost display ("$0.08")
- [ ] Bulk grid: Add per-item status badges (⟳/✅/❌/⏳)
- [ ] Bulk grid: Add progress counter ("2 of 5 complete")
- [ ] Bulk grid: Add [Retry] button for failed items
- [ ] Transition smoothly when result arrives

Status Templates (all 7 types):
```
IMAGE: "Generating image with {Model}... Est. 8s"
T2V: "Generating {AR} video ({Duration}s)... Est. 45s"
I2V: "Processing video from reference... Est. 50s"
MOTION: "Transferring motion... Est. 45s"
VOICE: "Synthesizing voice ({Chars} chars)... Est. 10s"
MUSIC: "Creating music ({Style})... Est. 20s"
BULK: "Processing 2 of 5... Est. 25s remaining"
```

Result: **Users see what's happening, can cancel, know how long it takes**

---

### PHASE 2: Video Analysis Complete (Week 4-5)
**MAJOR FEATURE — Separate from main generation flow**

NEW ENDPOINTS (Backend):
- [ ] POST /api/streams/check-video-accessibility (check if URL embeddable)
- [ ] POST /api/streams/extract-video-frames (extract frames from video blob)
- [ ] POST /api/streams/analyze-video-for-duplication (OpenAI Vision analysis)
- [ ] POST /api/streams/analyst-chat (multi-turn conversation with analyst)

Frontend (NEW Section Above Prompt Card):
- [ ] Video URL input field + platform auto-detect
- [ ] Accessibility checker + "Record Screen" fallback button
- [ ] Video embed container (conditional iframes for YouTube/TikTok/FB/Instagram)
- [ ] Screen recording UI (MediaStream Recording API)
  - Browser permission request
  - Recording timer
  - Record/Stop buttons
- [ ] Frame extraction display
  - Spinner while extracting
  - Thumbnail preview
  - Frame count + metadata
- [ ] Video analysis display
  - Visual analysis text
  - Motion analysis text
  - Generated prompt (for video recreation, NOT description)
  - Confidence score (color-coded)
  - Provider recommendation
- [ ] Analyst chat component
  - Conversation history
  - User input field + send button
  - Real-time prompt updates
  - Confidence score updates
- [ ] "Use This Prompt" button → fills prompt textarea

State Variables (New):
```
uploadedUrl, detectedPlatform, canEmbed
recordingState, recordedVideoBlob, isRecording
framesState, extractedFrames, uploadedThumbnail
analysisVideoState, videoAnalysis, videoAnalysisConfidence
chatMessages, currentAnalyzedPrompt, promptConfidence
```

Result: **Complete video reference → AI analysis → prompt generation workflow**

---

### PHASE 3: Video Thumbnail Selection (Week 5-6)
**WORKS WITH EXISTING & NEW VIDEO MODES**

Frontend (Add to Video Output):
- [ ] Timeline slider component (0:00 to end)
- [ ] Preview thumbnail updates as slider moves
- [ ] "Use as Thumbnail" button
- [ ] Save selected frame as video thumbnail
- [ ] Works for: T2V outputs, I2V outputs, Motion outputs, uploaded videos

Backend (Optional):
- [ ] Store thumbnail_timestamp in generation_jobs table
- [ ] API to extract frame at specific timestamp

State Variables (New):
```
thumbnailTime, selectedThumbnail, thumbnailPreviewUrl
```

Result: **Users pick perfect frame for video thumbnail**

---

### PHASE 4: Advanced Player Options (Week 7-8)
**OPTIONAL — Improves workflow but not critical**

Phase 4A (MVP):
- [ ] Timeline with start/end selection (drag to select range)
- [ ] Frame preview grid (see thumbnails of selected frames)
- [ ] Playback speed controls (0.25x to 1.5x to 2x)

Phase 4B (Nice to Have):
- [ ] Frame-by-frame navigation (arrow keys)
- [ ] Segment markers (label [Intro] [Dance] [Outro])
- [ ] Auto key frame detection (scene/motion/lighting changes)

Phase 4C (Optional Advanced):
- [ ] OBS fallback option (detect if installed, launch, accept MP4 upload)

Backend Updates (Phase 4):
- [ ] Update analyze-video-for-duplication to accept timeRange
- [ ] Update frame extraction to use timeRange
- [ ] Update system prompt to tell AI what range was selected
- [ ] Return analysis scope in response

Result: **Users analyze only the parts they care about, better focused prompts**

---

### PHASE 5: Generation Type-Specific Features (Week 9+)
**LOWER PRIORITY — Can iterate on later**

Image Mode:
- [ ] Multi-image thumbnail selector (show all, user picks favorite)

T2V/I2V/Motion:
- [ ] Aspect ratio preview (show how 16:9 vs 9:16 looks)
- [ ] Reference image preview (show uploaded image during generation)
- [ ] Side-by-side comparison ([Source] [Reference] [Result])

Voice:
- [ ] Voice sample playback (pre-generation preview)
- [ ] Stability/similarity controls (sliders 0-1)
- [ ] Playback speed adjustment (post-generation)

Music:
- [ ] BPM control (80-160 range)
- [ ] Duration selection (15s/30s/60s)
- [ ] Lyric preview (parse structure)

Bulk:
- [ ] Multi-prompt bulk generation (5 different prompts, not just variations)
- [ ] Per-item retry (failed items get [Retry] button)
- [ ] Cancel all (stop pending items)
- [ ] Export ZIP (download all results as ZIP file)

Result: **Each generation type has specialized tools for best results**

---

## BUILD PRIORITIES (MUST → NICE → LATER)

### MUST (Core Experience):
1. **Phase 0:** Persistence (database + endpoints) — **WEEKS 1-2**
2. **Phase 1:** Status indicators (all 7 types) — **WEEK 3**
3. **Phase 2:** Video analysis (complete workflow) — **WEEKS 4-5**

### NICE (Improved Workflow):
4. **Phase 3:** Video thumbnail selection — **WEEKS 5-6**
5. **Phase 4A:** Advanced player (timeline, speed) — **WEEKS 7-8**

### LATER (Polish & Specialization):
6. **Phase 4B:** Smart player features (segments, key frames) — **WEEKS 8+**
7. **Phase 5:** Type-specific features (image multi-select, voice samples, etc) — **WEEKS 9+**
8. **Phase 4C:** OBS integration (optional) — **LATER**

---

## TRACKING ACROSS ALL 7 GENERATION TYPES

Each type will have:
- ✅ Status indicator (spinner + text + timer + cancel)
- ✅ Thumbnail selection (if video)
- ✅ Type-specific controls (will be added in Phase 5)
- ✅ Persistent background generation
- ✅ Non-blocking UI
- ✅ Can bulk generate without waiting

---

## WHAT DOES NOT GET BUILT (Out of Scope)

❌ OBS embedding (not embeddable, offer as optional fallback in Phase 4C)
❌ WebSocket real-time (polling every 2s is sufficient)
❌ ML-based scene detection (Phase 4B, optional)
❌ Full video editing suite (out of scope)
❌ Per-pixel analysis (too complex)
❌ Multi-user collaboration (future feature)
❌ Cost analytics dashboard (can add later)

---

## FILES TO MODIFY/CREATE

### EXISTING (Modify):
- `src/components/streams/tabs/GenerateTab.tsx` (add all new UI)
- `src/app/api/streams/video/status/route.ts` (modify polling for persistence)

### NEW (Create):
- `src/app/api/streams/generate-job/route.ts`
- `src/app/api/streams/check-video-accessibility/route.ts`
- `src/app/api/streams/extract-video-frames/route.ts`
- `src/app/api/streams/analyze-video-for-duplication/route.ts`
- `src/app/api/streams/analyst-chat/route.ts`
- `src/components/streams/VideoAnalysisUpload.tsx` (new component)
- `src/components/streams/ScreenRecorder.tsx` (new component)
- `src/components/streams/AnalystChat.tsx` (new component)
- `src/components/streams/VideoThumbnailSelector.tsx` (new component)
- `src/lib/persistence/GenerationManager.ts` (new helper)

### DATABASE:
- Migration: Add generation_jobs table
- Migration: Add bulk_jobs table
- Migration: Add columns to generation_log (optional, for extras)

---

## VERIFICATION CHECKLIST

### Architecture:
- [ ] Database tables created (generation_jobs, bulk_jobs)
- [ ] Persistence manager implemented
- [ ] localStorage backup working
- [ ] Resume on app load working
- [ ] Non-blocking job submission working

### Video Analysis:
- [ ] Video embedding working (all 4 platforms)
- [ ] Screen recording working
- [ ] Frame extraction working (both ffmpeg.wasm + backend)
- [ ] OpenAI Vision analysis working
- [ ] Analyst chat working (multi-turn)
- [ ] Analysis auto-runs on upload
- [ ] User can edit analysis
- [ ] "Use This Prompt" button working

### Status Indicators:
- [ ] Spinner shows while polling
- [ ] Status text displays (mode-specific)
- [ ] Time estimate shows
- [ ] Cancel button works
- [ ] Bulk grid shows per-item status
- [ ] Progress counter updates

### Thumbnail Selection:
- [ ] Timeline slider works
- [ ] Preview updates as slider moves
- [ ] "Use as Thumbnail" saves selection
- [ ] Works for all video modes

### Performance:
- [ ] No memory leaks from polling
- [ ] Smooth state updates
- [ ] No UI blocking
- [ ] localStorage doesn't cause slowdown
- [ ] Database queries optimized

### Testing:
- [ ] Refresh page → resumes
- [ ] Close browser → resumes next session
- [ ] Network disconnect → resumes
- [ ] Multiple concurrent generations
- [ ] Bulk generation (parallel/sequential)
- [ ] Failed item retry
- [ ] Cancel during generation

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Database gets huge | Archive old jobs >30 days |
| Server down while generating | 30s background polling daemon |
| Provider doesn't support cancel | Mark as cancelled, ignore result |
| UI blocks during polling | Async/await, use useEffect hooks |
| Lost jobs on refresh | localStorage + database redundancy |
| ffmpeg server overhead | Hybrid approach (preview client, full server) |

---

## SUMMARY: COMPLETE SCOPE

### What We're Building:
1. **Persistent generation system** (survive anything)
2. **Status indicators** (all 7 types, know what's happening)
3. **Complete video analysis** (reference → analysis → prompt)
4. **Advanced player** (timeline selection, speed control)
5. **Thumbnail selection** (pick perfect frame)
6. **Type-specific features** (phased, add as needed)

### What We're NOT Building:
- OBS embedding (offer as fallback)
- WebSocket (polling works fine)
- ML scene detection (optional Phase 4B)
- Collaboration features
- Cost analytics dashboard

### Result:
**Professional AI generation platform where:**
- ✅ Generations never get lost
- ✅ Users see status in real-time
- ✅ Can upload videos for AI analysis
- ✅ Can bulk generate without waiting
- ✅ Can start multiple different generations
- ✅ Survives page refresh, browser close, session restart

---

## NEXT STEPS

1. **Review this plan**
2. **Confirm priorities** (MUST/NICE/LATER)
3. **Assign implementation order** (Phases 0-5)
4. **Start Phase 0** (persistence foundation)
5. **Don't skip Phase 0** — everything else depends on it

