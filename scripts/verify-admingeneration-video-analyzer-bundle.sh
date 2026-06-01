#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
ANALYSIS_ID="${ANALYSIS_ID:-1a611e72-49fa-4665-b881-aab1d3b0426f}"

echo "=============================================="
echo "VERIFY admingeneration video analyzer bundle"
echo "BASE_URL=$BASE_URL"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "=============================================="

echo "1) GET analysis intelligence"
curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence" | grep -q '"ok":true'
echo "✅ intelligence route ok"

echo "2) Create editor project from analysis"
EDITOR_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/from-analysis" \
  -H "Content-Type: application/json" \
  -d "{\"analysisId\":\"$ANALYSIS_ID\"}")"
echo "$EDITOR_JSON" | grep -q '"ok":true'
EDITOR_ID="$(node -e "const data=JSON.parse(process.argv[1]); console.log(data.editorProject.id)" "$EDITOR_JSON")"
echo "✅ editor project created: $EDITOR_ID"

echo "3) GET editor project"
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID" | grep -q '"ok":true'
echo "✅ editor project reload ok"

echo "4) GET editor intelligence bridge"
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/intelligence" | grep -q '"ok":true'
echo "✅ editor intelligence bridge ok"

echo "5) GET editor timeline"
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/timeline" | grep -q '"ok":true'
echo "✅ editor timeline ok"

echo "6) Create worker job"
JOB_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs" \
  -H "Content-Type: application/json" \
  -d '{"requestedProfile":"admin_full"}')"
echo "$JOB_JSON" | grep -q '"ok":true'
JOB_ID="$(node -e "const data=JSON.parse(process.argv[1]); console.log(data.job.id)" "$JOB_JSON")"
echo "✅ worker job created: $JOB_ID"

echo "7) GET worker job"
curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs/$JOB_ID" | grep -q '"ok":true'
echo "✅ worker job status ok"

if [ -n "${ADMIN_GENERATION_KEY:-}" ]; then
  echo "8) POST worker heartbeat"
  curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs/$JOB_ID/heartbeat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_GENERATION_KEY" \
    -d '{"status":"running","stage":"verify_heartbeat","progress":1,"message":"Verification heartbeat"}' | grep -q '"ok":true'
  echo "✅ worker heartbeat ok"
else
  echo "⚠️ Skipping heartbeat: ADMIN_GENERATION_KEY not set in shell"
fi

echo "=============================================="
echo "✅ VERIFY COMPLETE"
echo "=============================================="
