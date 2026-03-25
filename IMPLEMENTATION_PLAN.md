# IMPLEMENTATION PLAN
## Source of Truth: streamsai_scratch_video_ultra.docx
## Code Skeleton: streamsai_FULL_production_codepack.zip

---

## EXISTING FILES

### src/lib/ai/providers/kling.ts
**KEEP** — Full production Kling provider with JWT auth, T2V, I2V, image generation.
The ZIP ships a mock stub. The repo has the real implementation. Keep repo version.

### src/app/api/generations/route.ts
**MODIFY** — Route handles image/video/script/voice/i2v. Add T2V scratch video path that:
  - sanitizes prompt before submission
  - injects realism anchors
  - submits to Kling with realism-enforced prompt
  Currently missing: prompt sanitization for T2V. Add it.

### src/app/api/cron/check-videos/route.ts
**KEEP** — Full polling implementation with Kling + Runway support, Supabase upload,
batch processing. Far more complete than ZIP stub. Keep repo version.

### src/app/api/webhook/video-complete/route.ts
**MODIFY** — Receives Kling/Runway completion. Currently stores video and updates DB.
Needs: trigger QC scoring after completion, store qc_score on generation row.

### src/app/dashboard/video/page.tsx
**MODIFY** — Existing rich dashboard UI. Add realism mode selector and sanitized
prompt preview so user sees what actually goes to Kling.

---

## NEW FILES TO CREATE

### src/lib/media-realism-video/types.ts
**ADD** — Full type contracts for T2V system per spec.
Types: T2VInput, T2VCandidate, T2VQcScore, T2VResult, FrameAnalysis,
MotionPolicy, RealismMode, SanitizeResult, PostProcessResult.

### src/lib/media-realism-video/t2vPromptBuilder.ts
**ADD** — Per spec: sanitizePrompt() + expandPromptWithRealism().
sanitizePrompt: strips cinematic/artistic/dramatic terms.
expandPromptWithRealism: injects ordinary/real-world/natural motion anchors.
No business logic, no niche assumptions.

### src/lib/media-realism-video/t2vQc.ts
**ADD** — Per spec: scoreVideo() with dimensions:
  faceStability (hook ready), flickerDetection, warpDetection, temporalConsistency.
  Reject if totalScore < 0.9. Store rejectionReasons.
  Detection functions are hooks — currently return baseline scores.
  System is wired correctly so real CV can be plugged in later.

### src/lib/media-realism-video/t2vSelector.ts
**ADD** — Per spec: selectBestCandidate(candidates[]).
  Filter passing (score >= 0.9) → rank by totalScore → return best.
  If none pass: return block reason + all candidate scores.

### src/lib/media-realism-video/t2vPostProcess.ts
**ADD** — Per spec: postProcess(videoUrl) stub.
  ffmpeg re-encode, noise injection, compression normalization.
  Implemented as documented stub — real ffmpeg wiring is environment-dependent.

### src/lib/media-realism-video/generationClient.ts
**ADD** — Per spec: submitT2VCandidates(prompt, n=4) → submit n Kling jobs.
  Returns array of pending candidates with externalIds.
  Wraps existing KlingProvider without modifying it.

### src/app/api/video/scratch/route.ts
**ADD** — Production scratch video endpoint per spec flow:
  sanitize → expand → generate 4 candidates → poll/webhook → QC → select → return.
  Separate from /api/generations to keep concerns isolated.

---

## SPEC FILES (LOCKED — DO NOT MODIFY)

### src/lib/media-realism/types.ts
**KEEP EXACT** — spec contract for image pipeline.

### src/lib/media-realism/realismPolicy.ts
**KEEP EXACT** — spec policy.

### src/lib/media-realism/scenePlanner.ts
**KEEP EXACT** — spec planner.

### src/lib/media-realism/layoutPlanner.ts
**KEEP EXACT** — spec layout.

### src/lib/media-realism/promptCompiler.ts
**KEEP EXACT** — spec compiler.

### src/lib/media-realism/imageQc.ts
**KEEP EXACT** — spec image QC.

### src/lib/media-realism/videoQc.ts
**KEEP EXACT** — spec video QC (I2V).

### src/lib/media-realism/candidateSelector.ts
**KEEP EXACT** — spec selector.

### src/lib/media-realism/generationClient.ts
**KEEP EXACT** — spec generation client.

### src/lib/pipeline/pipeline-execution.ts
**KEEP EXACT** — spec pipeline orchestrator.

### src/lib/pipeline/governance/telehealth.ts
**KEEP EXACT** — spec domain pack adapter.

### src/lib/pipeline/qc/intakeGate.ts
**KEEP EXACT** — spec intake validation.

### src/lib/pipeline/qc/copyValidator.ts
**KEEP EXACT** — spec copy validator.

### src/lib/pipeline/qc/imageQc.ts
**KEEP EXACT** — spec image QC orchestrator.

### src/app/api/pipeline/run-node/route.ts
**KEEP EXACT** — spec pipeline route.

---

## TESTS TO CREATE

### src/test/unit/t2v.test.ts
**ADD** — Unit tests for every T2V module:
  - prompt sanitization strips banned terms
  - realism expansion injects required anchors
  - QC scoring rejects cinematic/unstable candidates
  - QC scoring accepts clean candidates
  - selector picks highest-scoring passing candidate
  - selector blocks if no candidate passes threshold
  - rejection loop retries up to 3 times

### src/test/e2e/realism.test.ts
**MODIFY** — Add T2V-specific tests:
  - cinematic video fails QC
  - unstable video (face drift) fails QC
  - clean video passes QC
  - full T2V flow produces valid output

---

## PIPELINE ORDER (MUST NOT CHANGE)
Step 1 → Strategy (AI generated)
Step 2 → Copy (AI generated)
Step 3 → Validator (config driven)
Step 4 → Image (realism engine: plan → compile → generate 4 → score → reject → select best)
Step 4.5 → Typography (HTML overlay ONLY — no text in AI image)
Step 5 → I2V (approved image only → Kling → QC → select)
Step 6 → Assets
Step 7 → QA

T2V SCRATCH VIDEO FLOW (separate from pipeline):
sanitize → expand → generate 4 → poll → QC score → reject failures → select best → post-process → return

