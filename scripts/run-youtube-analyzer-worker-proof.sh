#!/usr/bin/env bash
set -euo pipefail

ANALYSIS_ID="${1:?Usage: bash scripts/run-youtube-analyzer-worker-proof.sh <analysisId>}"
BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"

echo "=============================================="
echo "YOUTUBE VIA UNIFIED VIDEO ANALYZER WORKER"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "BASE_URL=$BASE_URL"
echo "=============================================="

python scripts/video-analyzer-worker.py "$ANALYSIS_ID"

INTEL_JSON="$(curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence")"
echo "$INTEL_JSON" | grep -q '"ok":true'

python - "$INTEL_JSON" <<'PY'
import json
import sys
data = json.loads(sys.argv[1])
assets = data.get("intelligence", {}).get("assets", [])
segments = data.get("intelligence", {}).get("segments", [])
frames = [asset for asset in assets if "frame" in str(asset.get("asset_kind", ""))]
audio = [asset for asset in assets if "audio" in str(asset.get("asset_kind", ""))]
video = [asset for asset in assets if "video" in str(asset.get("asset_kind", ""))]
if not assets or not segments or not frames or not audio or not video:
    raise SystemExit(f"Missing expected assets. assets={len(assets)} video={len(video)} frames={len(frames)} audio={len(audio)} segments={len(segments)}")
print(f"✅ intelligence populated: assets={len(assets)} video={len(video)} frames={len(frames)} audio={len(audio)} segments={len(segments)}")
PY

echo "=============================================="
echo "✅ YOUTUBE UNIFIED WORKER PROOF COMPLETE"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "=============================================="
