#!/usr/bin/env bash
set -euo pipefail

ANALYSIS_ID="${1:?Usage: bash scripts/run-enrich-analyzer-proof.sh <analysisId>}"
BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"

echo "=============================================="
echo "ANALYZER ENRICHMENT PROOF"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "BASE_URL=$BASE_URL"
echo "=============================================="

python scripts/enrich-analyzer-intelligence-worker.py "$ANALYSIS_ID"

INTEL_JSON="$(curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence")"
echo "$INTEL_JSON" | grep -q '"ok":true'

python - "$INTEL_JSON" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
analysis = data.get("analysis") or {}
blueprint = analysis.get("blueprint") or {}
segments = data.get("intelligence", {}).get("segments", [])
shots = blueprint.get("shots") or []
generation = blueprint.get("generation") or {}
transcript = analysis.get("transcript")
if not shots:
    raise SystemExit("Missing enriched blueprint shots")
if not generation.get("providerReadyPrompt"):
    raise SystemExit("Missing providerReadyPrompt")
if not segments:
    raise SystemExit("Missing enriched segments")
print(f"✅ enrichment verified: shots={len(shots)} segments={len(segments)} transcript={'yes' if transcript else 'no'} promptChars={len(generation.get('providerReadyPrompt',''))}")
PY

echo "=============================================="
echo "✅ ANALYZER ENRICHMENT PROOF COMPLETE"
echo "=============================================="
