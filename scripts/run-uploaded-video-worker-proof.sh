#!/usr/bin/env bash
set -euo pipefail

VIDEO_FILE="${1:?Usage: bash scripts/run-uploaded-video-worker-proof.sh /path/to/video.mp4}"
BASE_URL="${BASE_URL:-https://streamsailive.vercel.app}"
PROJECT_ID="${PROJECT_ID:-fb7bf446-78c9-4905-80bc-32a19d0f9803}"
BUCKET="${STREAMS_REFERENCE_BUCKET:-reference-assets}"

if [ ! -f "$VIDEO_FILE" ]; then
  echo "❌ Video file not found: $VIDEO_FILE"
  exit 1
fi

if [ -f ".env.local" ]; then
  set -a
  source .env.local
  set +a
fi

SUPABASE_REAL_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"

if [ -z "$SUPABASE_REAL_URL" ]; then
  echo "❌ SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required in .env.local"
  exit 1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY is required in .env.local"
  exit 1
fi

if [ -z "${ADMIN_GENERATION_KEY:-}" ]; then
  echo "❌ ADMIN_GENERATION_KEY is required in .env.local for worker event writes"
  exit 1
fi

echo "=============================================="
echo "REAL LOCAL MP4 WORKER PROOF"
echo "VIDEO_FILE=$VIDEO_FILE"
echo "BASE_URL=$BASE_URL"
echo "BUCKET=$BUCKET"
echo "=============================================="

UPLOAD_JSON="$(node - "$VIDEO_FILE" "$BUCKET" <<'NODE'
const fs = require("fs");
const path = require("path");

const filePath = process.argv[2];
const bucket = process.argv[3];
const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function safeName(name) {
  return (name || "video.mp4").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140);
}

(async () => {
  const fileName = safeName(path.basename(filePath));
  const objectPath = `admingeneration/reference/local-proof/${Date.now()}-${fileName}`;
  const bytes = fs.readFileSync(filePath);
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: bytes,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(text);
    process.exit(2);
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;

  console.log(JSON.stringify({
    ok: true,
    fileName,
    bucket,
    objectPath,
    publicUrl,
    size: bytes.length
  }));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE
)"

echo "$UPLOAD_JSON" | grep -q '"ok":true'
SOURCE_URL="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.publicUrl)" "$UPLOAD_JSON")"
echo "✅ uploaded directly to Supabase Storage"
echo "SOURCE_URL=$SOURCE_URL"

ANALYSIS_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze"   -H "Content-Type: application/json"   -d "{"sourceType":"upload","sourceUrl":"$SOURCE_URL","projectId":"$PROJECT_ID","title":"$(basename "$VIDEO_FILE")"}")"

echo "$ANALYSIS_JSON" | grep -q '"ok":true'
ANALYSIS_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.analysisId || d.analysis?.id)" "$ANALYSIS_JSON")"
echo "✅ analysis created: $ANALYSIS_ID"

JOB_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/worker-jobs"   -H "Content-Type: application/json"   -d '{"requestedProfile":"admin_full"}')"

echo "$JOB_JSON" | grep -q '"ok":true'
JOB_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.job.id)" "$JOB_JSON")"
echo "✅ worker job created: $JOB_ID"

echo "Checking local ffmpeg..."
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
echo "✅ ffmpeg + ffprobe available"

echo "Running real local ffmpeg worker..."
BASE_URL="$BASE_URL" ADMIN_GENERATION_KEY="$ADMIN_GENERATION_KEY" node scripts/video-analyzer-worker.mjs "$ANALYSIS_ID"

INTEL_JSON="$(curl -fsS "$BASE_URL/api/admingeneration/reference/analyze/$ANALYSIS_ID/intelligence")"
echo "$INTEL_JSON" | grep -q '"ok":true'

node -e '
const d=JSON.parse(process.argv[1]);
const assets=d.intelligence?.assets || [];
const segments=d.intelligence?.segments || [];
const frames=assets.filter(a => String(a.asset_kind || "").includes("frame"));
const audio=assets.filter(a => String(a.asset_kind || "").includes("audio"));
if (!assets.length) throw new Error("No extracted assets written");
if (!segments.length) throw new Error("No segments written");
if (!frames.length) throw new Error("No extracted frame assets written");
if (!audio.length) throw new Error("No extracted audio asset written");
console.log(`✅ intelligence populated: assets=${assets.length} frames=${frames.length} audio=${audio.length} segments=${segments.length}`);
' "$INTEL_JSON"

EDITOR_JSON="$(curl -fsS -X POST "$BASE_URL/api/admingeneration/editor/from-analysis"   -H "Content-Type: application/json"   -d "{"analysisId":"$ANALYSIS_ID"}")"

echo "$EDITOR_JSON" | grep -q '"ok":true'
EDITOR_ID="$(node -e "const d=JSON.parse(process.argv[1]); console.log(d.editorProject.id)" "$EDITOR_JSON")"
echo "✅ editor project created: $EDITOR_ID"

TIMELINE_JSON="$(curl -fsS "$BASE_URL/api/admingeneration/editor/projects/$EDITOR_ID/timeline")"
echo "$TIMELINE_JSON" | grep -q '"ok":true'

node -e '
const d=JSON.parse(process.argv[1]);
const counts=d.timeline?.counts || {};
if (!((counts.assets || 0) > 0)) throw new Error("Timeline did not expose extracted assets");
console.log(`✅ timeline route loaded with assets=${counts.assets || 0} segments=${(counts.editorSegments || 0) + (counts.intelligenceSegments || 0)}`);
' "$TIMELINE_JSON"

echo "=============================================="
echo "✅ REAL LOCAL MP4 WORKER PROOF COMPLETE"
echo "ANALYSIS_ID=$ANALYSIS_ID"
echo "JOB_ID=$JOB_ID"
echo "EDITOR_ID=$EDITOR_ID"
echo "SOURCE_URL=$SOURCE_URL"
echo "=============================================="
