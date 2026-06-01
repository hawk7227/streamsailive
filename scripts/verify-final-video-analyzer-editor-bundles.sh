#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
ANALYSIS_ID="${ANALYSIS_ID:-1a611e72-49fa-4665-b881-aab1d3b0426f}"

echo "=============================================="
echo "VERIFY FINAL VIDEO ANALYZER + EDITOR BUNDLES"
echo "BASE_URL=$BASE_URL"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "=============================================="

curl -fsS "$BASE_URL/admingeneration" | grep -qi "Video Analyzer"
echo "✅ page loads"

curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence" | grep -q '"ok":true'
echo "✅ intelligence ok"

EDITOR_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/from-analysis"   -H "Content-Type: application/json"   -d "{"analysisId":"$ANALYSIS_ID"}")"
echo "$EDITOR_JSON" | grep -q '"ok":true'
EDITOR_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.editorProject.id)" "$EDITOR_JSON")"
echo "✅ editor: $EDITOR_ID"

curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/timeline" | grep -q '"ok":true'
echo "✅ timeline ok"

JOB_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs"   -H "Content-Type: application/json"   -d '{"requestedProfile":"admin_full"}')"
echo "$JOB_JSON" | grep -q '"ok":true'
JOB_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.job.id)" "$JOB_JSON")"
echo "✅ worker job: $JOB_ID"

curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/provider-runs"   -H "Content-Type: application/json"   -d '{"provider":"provider_router","action":"verify_segment_edit"}' | grep -q '"ok":true'
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/qc"   -H "Content-Type: application/json"   -d '{"status":"pending_model_qc","checks":{"verify":true},"issues":[]}' | grep -q '"ok":true'
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/stitch-jobs"   -H "Content-Type: application/json"   -d '{"timelineSnapshot":{"verify":true}}' | grep -q '"ok":true'
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/exports"   -H "Content-Type: application/json"   -d '{"exportType":"mp4","settings":{"verify":true}}' | grep -q '"ok":true'
echo "✅ control plane ok"

if [ -n "${ADMIN_GENERATION_KEY:-}" ]; then
  curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs/$JOB_ID/heartbeat"     -H "Content-Type: application/json"     -H "Authorization: Bearer $ADMIN_GENERATION_KEY"     -d '{"status":"running","stage":"final_verify","progress":1,"message":"Final bundle verify heartbeat"}' | grep -q '"ok":true'
  echo "✅ heartbeat ok"
else
  echo "⚠️ heartbeat skipped: ADMIN_GENERATION_KEY not set"
fi

echo "=============================================="
echo "✅ FINAL VERIFY COMPLETE"
echo "=============================================="
