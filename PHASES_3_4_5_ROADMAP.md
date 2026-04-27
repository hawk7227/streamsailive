# PHASES 3-5 ROADMAP

## Current Status
- ✅ Phase 0: Persistence (100%)
- ✅ Phase 1: Status indicators (100%)
- ✅ Phase 2: Video analysis (100%)
- ⏳ Phase 3: Thumbnail selection (0%)
- ⏳ Phase 4: Advanced player (0%)
- ⏳ Phase 5: Type-specific features (0%)

---

## PHASE 3: THUMBNAIL SELECTION (2-3 days)

### Goal
Allow users to select a specific frame from extracted video as thumbnail before generating.

### New Files
- `src/components/streams/VideoThumbnailSelector.tsx` (300 lines)
  * Timeline slider with frame scrubbing
  * Grid of frame previews (1, 3, 5, 10 frames)
  * Selected frame highlight
  * "Use as thumbnail" button
  * Share selected frame

- `src/app/api/streams/save-thumbnail/route.ts`
  * Save selected frame to database
  * Link to generation_jobs table

- `src/lib/streams/ThumbnailManager.ts`
  * Manage thumbnail state
  * Upload selected frame to storage

### Features
1. Timeline scrubber
   - Drag to any point in video
   - Shows current timestamp
   - Displays frame preview in real-time

2. Preset grids
   - 1 frame (key moment)
   - 3 frames (beginning, middle, end)
   - 5 frames (distributed)
   - 10 frames (granular)

3. Frame selection
   - Click frame to select
   - Shows "selected" badge
   - Preview in larger view

4. Thumbnail preview
   - Shows selected frame in generation output
   - Displayed in grid before video uploads

### API Integration
```
POST /api/streams/save-thumbnail
{
  generationId: string,
  frameTimestamp: number,
  frameDataUrl: string
}
```

### UI Integration
- Expand VideoAnalysisUpload → click "Next: Select Thumbnail"
- Replace current output grid with thumbnail selector
- Show preview of final thumbnail

### Build Time
- Component: 1.5 days
- API + integration: 0.5 day
- Testing: 1 day

---

## PHASE 4: ADVANCED PLAYER (2-4 days) [OPTIONAL]

### Goal
Frame-by-frame navigation, segment marking, playback controls for video output.

### New Files
- `src/components/streams/AdvancedVideoPlayer.tsx` (400 lines)
  * Frame-by-frame controls (← →)
  * Current frame display
  * Playback speed (0.5x, 1x, 2x)
  * Loop/pause controls

- `src/components/streams/VideoSegmentMarker.tsx` (250 lines)
  * Mark segments (intro/main/outro)
  * Color-coded timeline
  * Segment export

- `src/lib/streams/VideoPlayerState.ts`
  * Frame position state
  * Playback speed
  * Segment markers

### Features
1. Frame controls
   - Show current frame number / total
   - Prev/Next frame (keyboard: ← →)
   - Jump to frame (input field)

2. Playback
   - Speed control dropdown (0.5x to 2x)
   - Loop current segment
   - Reverse playback

3. Segment marking
   - Mark in/out points
   - Drag segment handles
   - Export segment as clip
   - Color code segments

4. Keyboard shortcuts
   - Space: Play/pause
   - ← →: Frame navigation
   - [ ]: Mark in/out
   - L: Loop segment

### API Integration
```
POST /api/streams/save-segment
{
  generationId: string,
  startFrame: number,
  endFrame: number,
  label: string
}
```

### Build Time
- Player component: 1.5 days
- Segment marker: 1 day
- Keyboard/testing: 1.5 days

---

## PHASE 5: TYPE-SPECIFIC FEATURES (5+ days)

### Goal
Mode-specific controls and presets for each generation type.

### Features by Mode

#### Image Mode
- Multi-image batch generation
  * Generate 3/5/10 variations
  * Show all in grid
  * Side-by-side comparison
  
- Style selector
  * Photo-realistic
  * Artistic
  * Illustration
  * 3D
  * Anime

- Advanced controls
  * Aspect ratio lock
  * Custom dimensions (256-2048px)
  * Quality slider (draft → production)
  * Safety filter toggle

- Files
  * `src/components/streams/ImageVariationBatch.tsx`
  * `src/components/streams/ImageStyleSelector.tsx`

#### Video Mode (T2V/I2V)
- Aspect ratio preview
  * Live preview of output dimensions
  * Common presets (9:16, 16:9, 1:1)

- Motion intensity
  * Slider: Static → Cinematic
  * Preview affects status message

- Video reference browser
  * Browse similar videos on platform
  * "Inspired by" suggestions
  * One-click prompt generation

- Files
  * `src/components/streams/VideoMotionPreview.tsx`
  * `src/components/streams/ReferenceVideoBrowser.tsx`

#### Voice Mode
- Voice stability control
  * Slider: Consistent → Varied
  * Show current setting in status

- Accent/style selector
  * Neutral, British, American, etc.
  * Different emotion (neutral, happy, sad)

- Character count limits
  * Show remaining characters
  * Warn if exceeds limit

- Files
  * `src/components/streams/VoiceStabilityControl.tsx`
  * `src/components/streams/VoiceStyleSelector.tsx`

#### Music Mode
- BPM control
  * Input field: 60-200 BPM
  * Tap tempo button
  * Visualizer preview

- Mood selector
  * Happy, sad, epic, chill, energetic
  * Visual mood icons

- Instrument picker
  * Select primary instruments
  * Add secondary instruments
  * Visualize arrangement

- Files
  * `src/components/streams/MusicBPMControl.tsx`
  * `src/components/streams/MusicMoodSelector.tsx`

### Bulk Operations
- Parallel generation
  * Queue multiple generations
  * See all in one view
  * Cancel entire batch

- Batch presets
  * Save as preset (all modes + settings)
  * Load preset for one-click batches
  * Share presets with team

- Files
  * `src/components/streams/BulkGenerationQueue.tsx`
  * `src/lib/streams/PresetManager.ts`

### Build Time
- Image features: 1.5 days
- Video features: 1.5 days
- Voice features: 1 day
- Music features: 1 day
- Bulk/presets: 1 day
- **Total: 6 days**

---

## IMPLEMENTATION ORDER

### Week 1-2
1. ✅ Phase 0-2 (done)
2. Phase 3 (thumbnail selection)

### Week 3
3. Phase 4 (advanced player) - parallel with Phase 5 start
4. Phase 5 (type-specific) - Image + Video modes

### Week 4
5. Phase 5 continued - Voice + Music modes
6. Phase 5 continued - Bulk operations + presets

### Week 5
7. Full integration testing
8. Performance optimization
9. Production deployment

---

## TECHNICAL DETAILS

### Database Changes
- Add `generation_thumbnails` table
- Add `video_segments` table
- Add `generation_presets` table
- Add `preset_shares` table (team sharing)

### API Endpoints Needed
- POST `/api/streams/save-thumbnail`
- POST `/api/streams/save-segment`
- POST `/api/streams/create-preset`
- GET `/api/streams/presets`
- POST `/api/streams/apply-preset`

### State Management
- VideoPlayerState (frame position, playback speed)
- SegmentMarkerState (in/out points)
- PresetState (current preset, saved presets)
- BatchQueueState (queued generations)

### Performance Considerations
- Lazy load large frame grids (virtualization)
- Cache frame data URLs in localStorage
- Batch API calls for multi-frame requests
- Optimize video scrubbing (debounce)

---

## SUCCESS CRITERIA

### Phase 3
- [ ] Can scrub timeline and see frame previews
- [ ] Can select 1, 3, 5, or 10 frame grid
- [ ] Selected frame displayed before upload
- [ ] Thumbnail saved to database
- [ ] Zero flicker during scrubbing

### Phase 4
- [ ] Can step through frames with arrow keys
- [ ] Playback speed controls work
- [ ] Can mark segments with in/out
- [ ] Segment export creates valid clip
- [ ] Keyboard shortcuts responsive

### Phase 5
- [ ] Image batches generate all 3/5/10 variations
- [ ] Video aspect ratio preview is accurate
- [ ] Voice stability affects output quality
- [ ] Music BPM controls generation
- [ ] Presets save/load correctly
- [ ] Bulk queues show estimated time

---

## NOTES FOR IMPLEMENTATION

1. **Frame scrubbing**: Use debounce (200ms) to avoid too many API calls
2. **Video segments**: Store as {start_frame, end_frame, duration_ms}
3. **Type-specific UI**: Use conditional rendering, keep GenerateTab clean
4. **Presets**: Store as JSON, include all model parameters
5. **Keyboard shortcuts**: Register globally, not just in player
6. **Testing**: Each phase needs end-to-end test on staging before merge

---

## BLOCKERS RESOLVED
- ✅ Video frame extraction (FFmpeg implemented)
- ✅ Error handling (UI now shows errors)
- ✅ Workspace logic (real workspace IDs now used)
- ✅ Auth context (real user from Supabase)

Ready to start Phase 3 whenever you're ready.
