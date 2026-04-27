# COMPLETE IMPLEMENTATION ROADMAP
## Visual Editor (10 phases) + GenerateTab Enhancements (5 phases) + All Features

**Total: 15 Phases | 6-8 Weeks | 2 Major Deployments**

---

## EXECUTIVE SUMMARY

### What's Being Built
1. **Visual Component Editor** — Edit React files + see live iPhone preview
2. **GenerateTab Enhancements** — Video analysis, persistent background jobs, status indicators
3. **Advanced Generation Tools** — Thumbnail selection, smart player, type-specific features

### What's NOT Being Built
- ❌ OBS embedding (fallback only)
- ❌ WebSocket (polling sufficient)
- ❌ ML scene detection (Phase 4B, optional)
- ❌ Collaboration features
- ❌ Cost analytics dashboard

### What's Being Kept
- ✅ All existing endpoints (Image, T2V, I2V, Motion, Voice, Music, Bulk)
- ✅ All existing UI (Topbar, Mode strip, Prompt card, Output card)
- ✅ All existing state (30+ variables)
- ✅ All existing functions (handleGenerate, runAnalyst, polling)
- ✅ Chat features (100% untouched)

---

## TIMELINE OVERVIEW

```
WEEK 1-2:   Visual Editor Phase 0-1 (Foundation + File I/O) ✅ DONE
            GenerateTab Phase 0 (Persistence foundation) — START HERE
            
WEEK 3:     Visual Editor Phase 2 (Live preview)
            GenerateTab Phase 1 (Status indicators)
            
WEEK 4-5:   Visual Editor Phase 3-4 (Click-to-inspect + Properties)
            GenerateTab Phase 2 (Video analysis)
            
WEEK 5-6:   Visual Editor Phase 5 (Monaco editor)
            GenerateTab Phase 3 (Thumbnail selection)
            
WEEK 7-8:   Visual Editor Phase 6-7 (Safe areas + Measurements)
            GenerateTab Phase 4A (Advanced player MVP)
            
WEEK 8+:    Visual Editor Phase 8-10 (Image analyzer + GitHub + Polish)
            GenerateTab Phase 4B (Smart player) + Phase 5 (Type-specific)
```

---

## PHASE BREAKDOWN

### PARALLEL WORK (Can happen simultaneously)

**VISUAL EDITOR TRACK** (10 phases)
- Phase 1: ✅ DONE (Layout + File I/O)
- Phase 2: Live preview iframe (3 days)
- Phase 3: Click-to-inspect (3 days)
- Phase 4: Property editor (3 days)
- Phase 5: Monaco editor (2 days)
- Phase 6: Safe areas (1 day)
- Phase 7: Measurements (2 days)
- Phase 8: Image analyzer (3 days)
- Phase 9: GitHub push (2 days)
- Phase 10: Polish (1 day)

**GENERATETAB TRACK** (5 phases, 2 parallel with Visual Editor)
- Phase 0: Persistence foundation (2 days) — **START IMMEDIATELY**
- Phase 1: Status indicators (3 days)
- Phase 2: Video analysis (5 days)
- Phase 3: Thumbnail selection (2 days)
- Phase 4A: Advanced player MVP (2 days)
- Phase 4B: Smart player (2 days, optional)
- Phase 5: Type-specific features (5+ days, optional)

---

## DETAILED PHASE BREAKDOWN

### VISUAL EDITOR — PHASE 0-1 (Already Done ✅)
**Status: COMPLETE**
- ✅ `/visual-editor` route
- ✅ `/api/visual-editor/files` endpoint
- ✅ File tree loading
- ✅ Code editor with auto-save
- ✅ Collapsible panels
- **Next:** Phase 2 (live preview)

---

### GENERATETAB — PHASE 0: PERSISTENCE FOUNDATION (MUST START HERE)
**Duration: 2 days**
**Priority: CRITICAL — Everything else depends on this**

#### Backend (New)
```
NEW ENDPOINTS:
POST   /api/streams/generate-job           (create job, return immediately)
GET    /api/streams/generate-job/:id       (check status)
GET    /api/streams/my-generations         (resume session — return active jobs)
POST   /api/streams/generate-job/:id/cancel
POST   /api/streams/bulk-job               (create bulk)
GET    /api/streams/bulk-job/:id           (check status)
POST   /api/streams/bulk-job/:id/cancel-all

NEW BACKGROUND DAEMON:
- Runs every 30 seconds
- Checks all jobs with status IN ('pending', 'processing')
- Updates database with latest state
- Handles timeouts (>30 mins = cancelled)
```

#### Database (New Tables)
```sql
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  mode STRING NOT NULL,           -- 'image', 't2v', 'i2v', 'motion', 'voice', 'music'
  status STRING NOT NULL,         -- 'pending', 'processing', 'complete', 'failed', 'cancelled'
  prompt TEXT,
  provider STRING,
  cost DECIMAL,
  result_url STRING,
  result_metadata JSONB,
  error_message STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP            -- 30 days from creation
);

CREATE TABLE bulk_jobs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status STRING NOT NULL,         -- 'pending', 'processing', 'complete', 'failed'
  items_total INT,
  items_complete INT,
  items_failed INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (id) REFERENCES generation_jobs(id)
);

ALTER TABLE generation_jobs ADD COLUMN bulk_job_id UUID;
```

#### Frontend (New Components)
```
NEW FILES:
src/lib/persistence/GenerationManager.ts   (resume on app load)
src/hooks/useGenerationPersistence.ts      (localStorage backup)

NEW LOGIC IN GenerateTab.tsx:
- On mount: call useGenerationPersistence()
- Get active jobs from API /my-generations
- Resume polling for each
- Update state from database
- localStorage backup for emergency recovery
```

#### State Variables (New)
```
activeGenerations: Map<id, GenerationJob>
failedGenerations: Map<id, error>
completedGenerations: Map<id, result>
resumedFromSession: boolean
```

#### Testing Checklist
- [ ] Refresh page → resumes all active jobs
- [ ] Close browser → resumes next session
- [ ] Network disconnect → resumes
- [ ] Multiple concurrent generations
- [ ] localStorage doesn't cause slowdown
- [ ] Database queries optimized

#### Files to Create/Modify
- [ ] `src/app/api/streams/generate-job/route.ts` (NEW)
- [ ] `src/app/api/streams/my-generations/route.ts` (NEW)
- [ ] `src/lib/persistence/GenerationManager.ts` (NEW)
- [ ] `src/components/streams/tabs/GenerateTab.tsx` (MODIFY - add persistence)
- [ ] Database migration (NEW)

#### Commit Message
```
feat: GenerateTab Phase 0 - Persistent background generation system

- Add generation_jobs + bulk_jobs tables
- Create 7 new API endpoints for job management
- Add background polling daemon (30s interval)
- Implement GenerationManager for session resumption
- localStorage backup for emergency recovery
- Non-blocking job submission + concurrent generations
- Survive page refresh, browser close, session restart
```

---

### GENERATETAB — PHASE 1: STATUS INDICATORS (Week 3)
**Duration: 3 days**
**Priority: HIGH — Required for all 7 generation types**

#### What Gets Built
- Spinner animation (CSS)
- Status text (mode-specific messages)
- Time estimate ("Est. 15 seconds")
- Cancel button (while polling)
- Cost display ("$0.08")
- Bulk grid: Per-item status badges (⟳/✅/❌/⏳)
- Bulk grid: Progress counter ("2 of 5 complete")
- Bulk grid: Retry button for failed items

#### Status Messages (All 7 Types)
```
IMAGE:  "Generating image with {Model}... Est. 8s"
T2V:    "Generating {AR} video ({Duration}s)... Est. 45s"
I2V:    "Processing video from reference... Est. 50s"
MOTION: "Transferring motion... Est. 45s"
VOICE:  "Synthesizing voice ({Chars} chars)... Est. 10s"
MUSIC:  "Creating music ({Style})... Est. 20s"
BULK:   "Processing 2 of 5... Est. 25s remaining"
```

#### Frontend (Modify GenerateTab.tsx)
- [ ] Add spinner component (CSS animation)
- [ ] Show status text during polling
- [ ] Show time estimate
- [ ] Add Cancel button with confirmation
- [ ] Show cost estimate
- [ ] Update bulk grid with badges
- [ ] Add progress counter
- [ ] Smooth transitions on result arrival

#### Files to Modify
- [ ] `src/components/streams/tabs/GenerateTab.tsx` (add UI)

#### Commit Message
```
feat: GenerateTab Phase 1 - Status indicators for all 7 generation types

- Add spinner animation during generation
- Show mode-specific status messages
- Display time estimate + cost
- Add cancel button with confirmation
- Bulk grid: per-item status badges
- Bulk grid: progress counter + retry button
- Smooth state transitions
```

---

### GENERATETAB — PHASE 2: COMPLETE VIDEO ANALYSIS (Weeks 4-5)
**Duration: 5 days**
**Priority: HIGH — Major feature, separate flow**

#### New Endpoints (Backend)
```
POST /api/streams/check-video-accessibility       (check if URL embeddable)
POST /api/streams/extract-video-frames             (extract frames from video)
POST /api/streams/analyze-video-for-duplication    (OpenAI Vision analysis)
POST /api/streams/analyst-chat                     (multi-turn conversation)
```

#### What Gets Built
- Video URL input + platform detection (YouTube/TikTok/Facebook/Instagram)
- Embed iframes + screen recording fallback
- Frame extraction (hybrid: ffmpeg.wasm preview + backend full)
- Video duplication analysis (NOT just description)
- Analyst chat (multi-turn conversation)
- Upload reference + auto-analyze
- Editable analysis results
- "Use This Prompt" button

#### New Components (Frontend)
```
src/components/streams/VideoAnalysisUpload.tsx    (upload + detect)
src/components/streams/ScreenRecorder.tsx         (MediaStream Recording API)
src/components/streams/AnalystChat.tsx            (conversation UI)
src/components/streams/VideoFrameExtractor.tsx    (display extracted frames)
```

#### State Variables (New)
```
uploadedUrl, detectedPlatform, canEmbed
recordingState, recordedVideoBlob, isRecording
framesState, extractedFrames, uploadedThumbnail
analysisVideoState, videoAnalysis, videoAnalysisConfidence
chatMessages, currentAnalyzedPrompt, promptConfidence
```

#### Testing Checklist
- [ ] Video embedding works (all 4 platforms)
- [ ] Screen recording works (browser permission)
- [ ] Frame extraction works (both ffmpeg.wasm + backend)
- [ ] OpenAI Vision analysis works
- [ ] Analyst chat works (multi-turn)
- [ ] Analysis auto-runs on upload
- [ ] User can edit analysis
- [ ] "Use This Prompt" button works

#### Files to Create/Modify
- [ ] `src/app/api/streams/check-video-accessibility/route.ts` (NEW)
- [ ] `src/app/api/streams/extract-video-frames/route.ts` (NEW)
- [ ] `src/app/api/streams/analyze-video-for-duplication/route.ts` (NEW)
- [ ] `src/app/api/streams/analyst-chat/route.ts` (NEW)
- [ ] `src/components/streams/VideoAnalysisUpload.tsx` (NEW)
- [ ] `src/components/streams/ScreenRecorder.tsx` (NEW)
- [ ] `src/components/streams/AnalystChat.tsx` (NEW)
- [ ] `src/components/streams/VideoFrameExtractor.tsx` (NEW)
- [ ] `src/components/streams/tabs/GenerateTab.tsx` (MODIFY - add analysis section)

#### Commit Message
```
feat: GenerateTab Phase 2 - Complete video analysis workflow

- Video URL input with platform auto-detection (YouTube/TikTok/FB/IG)
- Video embedding (all platforms) + screen recording fallback
- Frame extraction (ffmpeg.wasm preview + backend full)
- OpenAI Vision video analysis (duplication detection, not description)
- Multi-turn analyst chat for refining analysis
- Auto-analyze on video upload
- Editable analysis results
- "Use This Prompt" button fills prompt textarea
```

---

### GENERATETAB — PHASE 3: VIDEO THUMBNAIL SELECTION (Weeks 5-6)
**Duration: 2 days**
**Works with existing + new video modes**

#### What Gets Built
- Timeline slider component
- Preview thumbnail updates as slider moves
- "Use as Thumbnail" button
- Save selected frame as video thumbnail
- Works for: T2V, I2V, Motion generated videos, uploaded videos

#### New Component
```
src/components/streams/VideoThumbnailSelector.tsx
```

#### State Variables (New)
```
thumbnailTime, selectedThumbnail, thumbnailPreviewUrl
```

#### Files to Modify
- [ ] `src/components/streams/tabs/GenerateTab.tsx` (add to video output)
- [ ] `src/components/streams/VideoThumbnailSelector.tsx` (NEW)

#### Commit Message
```
feat: GenerateTab Phase 3 - Video thumbnail selection

- Timeline slider to pick frame from video
- Live thumbnail preview as slider moves
- "Use as Thumbnail" button to save selection
- Works for all video modes (T2V, I2V, Motion, uploaded)
```

---

### GENERATETAB — PHASE 4A: ADVANCED PLAYER MVP (Weeks 7-8)
**Duration: 2 days**
**Optional but improves workflow significantly**

#### What Gets Built (MVP)
- Timeline with start/end selection (drag to select range)
- Frame preview grid (see thumbnails of selected frames)
- Playback speed controls (0.25x, 0.5x, 1x, 1.5x, 2x)

#### Files to Create
```
src/components/streams/AdvancedVideoPlayer.tsx (NEW)
```

#### Commit Message
```
feat: GenerateTab Phase 4A - Advanced video player (MVP)

- Timeline slider with start/end selection
- Frame preview grid for selected range
- Playback speed controls (0.25x-2x)
- Updated video analysis to use selected range
- AI prompt generation focused on selected segment
```

---

### GENERATETAB — PHASE 4B: SMART PLAYER FEATURES (Optional)
**Duration: 2 days**
**Phase 4B - if/when needed**

#### What Gets Built
- Frame-by-frame navigation (arrow keys)
- Segment markers (label [Intro] [Dance] [Outro])
- Auto key frame detection (scene/motion/lighting changes)

---

### GENERATETAB — PHASE 5: TYPE-SPECIFIC FEATURES (Optional)
**Duration: 5+ days**
**Phased, add as needed**

#### Image Mode
- Multi-image thumbnail selector

#### T2V/I2V/Motion
- Aspect ratio preview
- Reference image preview
- Side-by-side comparison

#### Voice
- Voice sample playback
- Stability/similarity controls
- Playback speed adjustment

#### Music
- BPM control (80-160)
- Duration selection (15s/30s/60s)
- Lyric preview

#### Bulk
- Multi-prompt generation
- Per-item retry
- Cancel all
- Export ZIP

---

## INTEGRATION POINTS

### Visual Editor → GenerateTab
- Visual editor lets users edit component code
- GenerateTab uses those edited components for generation
- No data sharing needed (independent systems)

### GenerateTab → Chat
- Chat features 100% untouched
- GenerateTab has separate UI
- No state collision possible

---

## BUILD PRIORITIES

### MUST (Core Experience)
1. **Visual Editor Phase 1** ✅ — DONE
2. **GenerateTab Phase 0** — Persistence (WEEKS 1-2) **START NOW**
3. **GenerateTab Phase 1** — Status indicators (WEEK 3)
4. **GenerateTab Phase 2** — Video analysis (WEEKS 4-5)
5. **Visual Editor Phase 2** — Live preview (parallel, WEEKS 3-4)

### NICE (Improved Workflow)
6. **GenerateTab Phase 3** — Thumbnail selection (WEEKS 5-6)
7. **Visual Editor Phase 3-4** — Click-to-inspect + Properties (parallel)
8. **GenerateTab Phase 4A** — Advanced player MVP (WEEKS 7-8)

### LATER (Polish & Specialization)
9. **Visual Editor Phase 5-10** — Monaco + advanced features (WEEKS 5+)
10. **GenerateTab Phase 4B** — Smart player features (optional)
11. **GenerateTab Phase 5** — Type-specific features (optional)

---

## DEPLOYMENT STRATEGY

### Checkpoint 1: GenerateTab Phase 0 Complete
```
✅ Persistence system working
✅ Background jobs resume
✅ Database tables created
✅ Vercel green
Timeline: End of Week 1-2
```

### Checkpoint 2: Visual Editor Phase 2 Complete
```
✅ Live preview iframe working
✅ Device switching working
✅ HMR reload on save
✅ Vercel green
Timeline: End of Week 3
```

### Checkpoint 3: GenerateTab Phase 1-2 Complete
```
✅ Status indicators working (all 7 types)
✅ Video analysis working
✅ Analyst chat working
✅ Vercel green
Timeline: End of Week 5
```

### Final Release: All Phases Complete
```
✅ Visual editor fully functional
✅ GenerateTab with all features
✅ Persistent background generation
✅ Advanced video analysis
✅ All checkpoints passed
Timeline: End of Week 8+
```

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Database gets huge | Archive jobs >30 days |
| Server down while generating | 30s background polling daemon |
| Provider doesn't support cancel | Mark as cancelled, ignore result |
| UI blocks during polling | Async/await, useEffect hooks |
| Lost jobs on refresh | localStorage + database redundancy |
| ffmpeg server overhead | Hybrid approach (client preview, server full) |
| Chat features broken | Completely separate code paths |
| Visual editor breaks production | /visual-editor is isolated route |

---

## SUCCESS CRITERIA

### Architecture
- [ ] Persistence system working (database + API)
- [ ] Background jobs survive refresh/restart
- [ ] Non-blocking job submission
- [ ] Concurrent generations supported
- [ ] localStorage backup working

### GenerateTab Features
- [ ] Status indicators for all 7 types
- [ ] Video analysis complete
- [ ] Analyst chat working
- [ ] Thumbnail selection working
- [ ] Advanced player working (Phase 4)
- [ ] Type-specific features working (Phase 5)

### Visual Editor Features
- [ ] Live preview working
- [ ] Click-to-inspect working
- [ ] Property editor working
- [ ] Monaco editor working
- [ ] Safe areas visible
- [ ] Measurements showing
- [ ] GitHub integration working

### Quality Gates
- [ ] All Build Rules pass
- [ ] No console errors
- [ ] Vercel green on every checkpoint
- [ ] No memory leaks
- [ ] No UI blocking
- [ ] No regression in chat

---

## SUMMARY

This roadmap delivers:

1. **Visual Component Editor** — Edit React code + see iPhone preview live
2. **Persistent Generation** — Jobs never get lost, survive anything
3. **Advanced Video Analysis** — Upload video → AI extracts insights → generates prompts
4. **Professional UI** — Status indicators, advanced player, thumbnail selection
5. **Type-Specific Tools** — Image multi-select, voice samples, music controls, bulk management

**Total effort:** 6-8 weeks  
**Total phases:** 15 (10 Visual Editor + 5 GenerateTab)  
**Total features:** 40+  
**Risk level:** LOW (modular, non-destructive to chat)  
**Chat impact:** ZERO (completely separate code paths)  

---

## NEXT STEP

**Start GenerateTab Phase 0 immediately** (2 days)
- It's the foundation for everything else
- No dependencies
- Can run parallel with Visual Editor Phase 2

Then alternate between:
- Visual Editor (frontend visual features)
- GenerateTab (backend + frontend generation features)

Both are 100% independent.
