#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
EDITOR_ID="${EDITOR_ID:?Set EDITOR_ID to a proven editor project id}"

echo "=============================================="
echo "VERIFY video editor execution control plane"
echo "BASE_URL=$BASE_URL"
echo "EDITOR_ID=$EDITOR_ID"
echo "=============================================="

echo "1) Provider run"
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/provider-runs" \
  -H "Content-Type: application/json" \
  -d '{"provider":"provider_router","action":"segment_edit","targetType":"project","requestNote":"verify provider run persistence"}' | grep -q '"ok":true'
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/provider-runs" | grep -q '"ok":true'
echo "✅ provider runs ok"

echo "2) Transcript edit"
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/transcript-edits" \
  -H "Content-Type: application/json" \
  -d '{"originalText":"old line","editedText":"new line for verification"}' | grep -q '"ok":true'
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/transcript-edits" | grep -q '"ok":true'
echo "✅ transcript edits ok"

echo "3) QC report"
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/qc" \
  -H "Content-Type: application/json" \
  -d '{"status":"pending_model_qc","passed":null,"checks":{"verify":true},"issues":[]}' | grep -q '"ok":true'
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/qc" | grep -q '"ok":true'
echo "✅ qc reports ok"

echo "4) Stitch job"
STITCH_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/stitch-jobs" \
  -H "Content-Type: application/json" \
  -d '{"timelineSnapshot":{"verify":true}}')"
echo "$STITCH_JSON" | grep -q '"ok":true'
STITCH_ID="$(node -e "const data=JSON.parse(process.argv[1]); console.log(data.stitchJob.id)" "$STITCH_JSON")"
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/stitch-jobs" | grep -q '"ok":true'
echo "✅ stitch jobs ok: $STITCH_ID"

echo "5) Export request"
curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/exports" \
  -H "Content-Type: application/json" \
  -d "{\"stitchJobId\":\"$STITCH_ID\",\"exportType\":\"mp4\",\"settings\":{\"verify\":true}}" | grep -q '"ok":true'
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/exports" | grep -q '"ok":true'
echo "✅ exports ok"

echo "6) Execution summary"
curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/version-actions" | grep -q '"ok":true'
echo "✅ execution summary ok"

echo "=============================================="
echo "✅ VERIFY COMPLETE"
echo "=============================================="
