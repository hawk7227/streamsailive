#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
ANALYSIS_ID="${ANALYSIS_ID:?Set ANALYSIS_ID to an analysis with extracted frames/audio/segments}"

echo "=============================================="
echo "VERIFY FINAL PRODUCTION BUNDLES"
echo "BASE_URL=$BASE_URL"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "=============================================="

curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/enrich" | grep -q '"ok":true'
echo "✅ enrichment route ok"

echo "Run this locally for real OpenAI enrichment:"
echo "BASE_URL=\"$BASE_URL\" bash scripts/run-enrich-analyzer-proof.sh \"$ANALYSIS_ID\""

EDITOR_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/from-analysis" \
  -H "Content-Type: application/json" \
  -d "{\"analysisId\":\"$ANALYSIS_ID\"}")"
echo "$EDITOR_JSON" | grep -q '"ok":true'
EDITOR_ID="$(python -c "import json,sys; print(json.loads(sys.argv[1])['editorProject']['id'])" "$EDITOR_JSON")"
echo "✅ editor project: $EDITOR_ID"

curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/versions" | grep -q '"ok":true'
echo "✅ versions route ok"

EXEC_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/execute-edit" \
  -H "Content-Type: application/json" \
  -d '{"instruction":"Verify edit request persistence","provider":"provider_router","action":"segment_edit","targetType":"project"}')"
echo "$EXEC_JSON" | grep -q '"ok":true'
echo "$EXEC_JSON" | grep -q 'blocked_provider_not_wired'
echo "✅ execute-edit route ok with truthful blocked provider state"

EXPORT_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/export-final" \
  -H "Content-Type: application/json" \
  -d '{"exportType":"mp4","settings":{"verify":true}}')"
echo "$EXPORT_JSON" | grep -q '"ok":true'
echo "$EXPORT_JSON" | grep -q 'blocked_render_worker_required'
echo "✅ export-final route ok with truthful blocked render state"

echo "=============================================="
echo "✅ FINAL PRODUCTION BUNDLE VERIFY COMPLETE"
echo "=============================================="
