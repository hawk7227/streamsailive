#!/usr/bin/env bash
set -euo pipefail

VIDEO_FILE="${1:?Usage: bash scripts/run-uploaded-video-worker-proof.sh /path/to/video.mp4}"
BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
PROJECT_ID="${PROJECT_ID:-fb7bf446-78c9-4905-80bc-32a19d0f9803}"

echo "=============================================="
echo "Upload + analyze + worker proof"
echo "VIDEO_FILE=$VIDEO_FILE"
echo "BASE_URL=$BASE_URL"
echo "=============================================="

UPLOAD_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/upload-and-analyze"   -F "file=@$VIDEO_FILE"   -F "projectId=$PROJECT_ID"   -F "requestedProfile=admin_full")"

echo "$UPLOAD_JSON" | grep -q '"ok":true'
ANALYSIS_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.analysisId)" "$UPLOAD_JSON")"
echo "✅ analysis created: $ANALYSIS_ID"

JOB_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs"   -H "Content-Type: application/json"   -d '{"requestedProfile":"admin_full"}')"
echo "$JOB_JSON" | grep -q '"ok":true'
JOB_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.job.id)" "$JOB_JSON")"
echo "✅ worker job created: $JOB_ID"

echo "Running local ffmpeg worker..."
node scripts/video-analyzer-worker.mjs "$ANALYSIS_ID"

INTEL_JSON="$(curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence")"
echo "$INTEL_JSON" | grep -q '"ok":true'
node -e '
const d=JSON.parse(process.argv[1]);
const assets=d.intelligence?.assets || [];
const segments=d.intelligence?.segments || [];
if (!assets.length) throw new Error("No extracted assets written");
if (!segments.length) throw new Error("No segments written");
console.log(`✅ intelligence populated: assets=${assets.length} segments=${segments.length}`);
' "$INTEL_JSON"

EDITOR_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/from-analysis"   -H "Content-Type: application/json"   -d "{"analysisId":"$ANALYSIS_ID"}")"
echo "$EDITOR_JSON" | grep -q '"ok":true'
EDITOR_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.editorProject.id)" "$EDITOR_JSON")"
echo "✅ editor project created: $EDITOR_ID"

curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/timeline" | grep -q '"ok":true'
echo "✅ timeline route loaded"

echo "=============================================="
echo "✅ UPLOADED VIDEO WORKER PROOF COMPLETE"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "JOB_ID=$JOB_ID"
echo "EDITOR_ID=$EDITOR_ID"
echo "=============================================="
