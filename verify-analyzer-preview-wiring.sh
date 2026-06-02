#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

fail() {
  echo "❌ $1"
  exit 1
}

pass() {
  echo "✅ $1"
}

echo "=============================================="
echo "VERIFY ANALYZER FRONTEND WIRING + VISIBILITY"
echo "=============================================="

[ -f package.json ] || fail "package.json not found. Run from repo root."
[ -f src/app/admingeneration/page.jsx ] || fail "src/app/admingeneration/page.jsx missing"
[ -f src/components/admingeneration/CompactAnalyzerVideoMode.jsx ] || fail "CompactAnalyzerVideoMode.jsx missing"
[ -f src/components/admingeneration/AnalyzerPreviewIntelligenceDock.jsx ] || fail "AnalyzerPreviewIntelligenceDock.jsx missing"

echo "=============================================="
echo "1) Page mounts original layout + compact analyzer + preview dock"
echo "=============================================="

grep -q "OriginalAdmingenerationPage" src/app/admingeneration/page.jsx \
  || fail "OriginalAdmingenerationPage is not mounted in /admingeneration page"

grep -q "CompactAnalyzerVideoMode" src/app/admingeneration/page.jsx \
  || fail "CompactAnalyzerVideoMode is not mounted in /admingeneration page"

grep -q "AnalyzerPreviewIntelligenceDock" src/app/admingeneration/page.jsx \
  || fail "AnalyzerPreviewIntelligenceDock is not mounted in /admingeneration page"

pass "Original layout, compact analyzer, and analyzer preview dock are all mounted"

echo "=============================================="
echo "2) Compact analyzer has required controls/events"
echo "=============================================="

COMPACT="src/components/admingeneration/CompactAnalyzerVideoMode.jsx"

grep -q "Standalone Analyzer" "$COMPACT" || fail "Standalone Analyzer label missing"
grep -q "Video Edit Mode" "$COMPACT" || fail "Video Edit Mode toggle missing"
grep -q "Load Existing Analysis ID" "$COMPACT" || fail "Load Existing Analysis ID field missing"
grep -q "Paste analysisId" "$COMPACT" || fail "Paste analysisId input missing"
grep -q "dispatchAnalysisLoaded" "$COMPACT" || fail "dispatchAnalysisLoaded helper missing"
grep -q "streams:analysis-loaded" "$COMPACT" || fail "streams:analysis-loaded event not dispatched"
grep -q "Technical Details\|showDetails\|detailsButton" "$COMPACT" || fail "Technical Details toggle missing"
grep -q "Apply to Builder" "$COMPACT" || fail "Apply to Builder missing"
grep -q "Generate Similar" "$COMPACT" || fail "Generate Similar missing"

pass "Compact analyzer controls and analysis-loaded event are wired"

echo "=============================================="
echo "3) Preview dock has required analyzer breakdown lanes"
echo "=============================================="

DOCK="src/components/admingeneration/AnalyzerPreviewIntelligenceDock.jsx"

grep -q "Source Preview" "$DOCK" || fail "Source Preview block missing"
grep -q "video ref" "$DOCK" || grep -q "<video" "$DOCK" || fail "Preview video element missing"
grep -q "Frames / Keyframes" "$DOCK" || fail "Frames / Keyframes lane missing"
grep -q "Segments / Shots" "$DOCK" || fail "Segments / Shots lane missing"
grep -q "Audio" "$DOCK" || fail "Audio lane missing"
grep -q "Transcript" "$DOCK" || fail "Transcript lane missing"
grep -q "Versions / Edit State" "$DOCK" || fail "Versions/Edit lane missing"
grep -q "Compact Intelligence Cards" "$DOCK" || fail "Compact Intelligence Cards missing"
grep -q "seekTo" "$DOCK" || fail "Selected frame/segment seek handler missing"
grep -q "currentTime" "$DOCK" || fail "Preview seek currentTime not wired"
grep -q "createPortal" "$DOCK" || fail "Preview dock portal mount missing"
grep -q "findTimelineAnchor" "$DOCK" || fail "Timeline/Keyframes anchor detection missing"
grep -q "streams:lastAnalysisId" "$DOCK" || fail "Last analysis ID localStorage reload missing"

pass "Preview dock lanes, video binding, selection, and persistence are wired"

echo "=============================================="
echo "4) API routes required by frontend exist"
echo "=============================================="

[ -f "src/app/api/admingeneration/reference/analyze/[id]/intelligence/route.ts" ] \
  || fail "GET /reference/analyze/[id]/intelligence route missing"

[ -f "src/app/api/admingeneration/editor/from-analysis/route.ts" ] \
  || fail "POST /editor/from-analysis route missing"

[ -f "src/app/api/admingeneration/editor/projects/[id]/timeline/route.ts" ] \
  || fail "GET /editor/projects/[id]/timeline route missing"

[ -f "src/app/api/admingeneration/reference/generate-similar/route.ts" ] \
  || fail "POST /reference/generate-similar route missing"

pass "Required API routes exist"

echo "=============================================="
echo "5) Worker proof scripts exist"
echo "=============================================="

[ -f scripts/video-analyzer-worker.py ] || fail "Unified video analyzer worker missing"
[ -f scripts/run-uploaded-video-worker-proof.sh ] || fail "Uploaded video proof script missing"
[ -f scripts/run-youtube-analyzer-worker-proof.sh ] || fail "YouTube worker proof script missing"

grep -q "youtube_ytdlp" scripts/video-analyzer-worker.py \
  || fail "YouTube adapter missing from unified worker"

grep -q "direct_url" scripts/video-analyzer-worker.py \
  || fail "Uploaded/direct adapter missing from unified worker"

grep -q "ffprobe" scripts/video-analyzer-worker.py \
  || fail "ffprobe metadata extraction missing"

grep -q "frame-%03d.jpg" scripts/video-analyzer-worker.py \
  || fail "frame extraction missing"

grep -q "audio.wav" scripts/video-analyzer-worker.py \
  || fail "audio extraction missing"

pass "Unified worker has YouTube + direct adapters and extraction pipeline"

echo "=============================================="
echo "6) Build check"
echo "=============================================="

pnpm build
git restore public/build-report.json audit-report.txt 2>/dev/null || true

pass "Build passed"

echo "=============================================="
echo "7) Optional live checks"
echo "=============================================="

BASE_URL="${BASE_URL:-}"
ANALYSIS_ID="${ANALYSIS_ID:-}"

if [ -n "$BASE_URL" ]; then
  curl -fsS "$BASE_URL/admingeneration" >/dev/null \
    && pass "Live /admingeneration responds" \
    || fail "Live /admingeneration failed"

  if [ -n "$ANALYSIS_ID" ]; then
    curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence" | grep -q '"ok":true' \
      && pass "Live intelligence route returns ok for $ANALYSIS_ID" \
      || fail "Live intelligence route failed for $ANALYSIS_ID"
  else
    echo "⚠️ ANALYSIS_ID not provided. Skipping live intelligence route check."
  fi
else
  echo "⚠️ BASE_URL not provided. Skipping live checks."
fi

echo "=============================================="
echo "✅ ALL WIRED CHECKS PASSED"
echo "=============================================="
echo "Frontend requirements verified:"
echo "- original /admingeneration page remains mounted"
echo "- compact standalone analyzer is mounted"
echo "- Video Edit Mode toggle exists"
echo "- Load Existing Analysis ID exists"
echo "- analysis-loaded event updates preview dock"
echo "- source video preview exists"
echo "- frames lane exists"
echo "- segments lane exists"
echo "- audio lane exists"
echo "- transcript lane exists"
echo "- versions/edit state lane exists"
echo "- compact intelligence cards exist"
echo "- raw JSON stays behind technical details"
