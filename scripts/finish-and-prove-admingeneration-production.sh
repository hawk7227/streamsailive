#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3199}"
BASE_URL="http://127.0.0.1:${PORT}"

fail() {
  echo "❌ $1"
  exit 1
}

pass() {
  echo "✅ $1"
}

echo "================================================="
echo "ADMINGENERATION PRODUCTION PROOF"
echo "================================================="
cd /c/Users/hawk7/streamsailive-admin-key

export NEXT_PUBLIC_SUPABASE_URL="https://dggunmqrbimlsuaohkpx.supabase.co"
export SUPABASE_URL="https://dggunmqrbimlsuaohkpx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZ3VubXFyYmltbHN1YW9oa3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjEwNSwiZXhwIjoyMDg0NTcyMTA1fQ.4yYB4tcGpKVD7Dm1-hMI4l863m5tUpkgXAWRuogW3sE"
echo ""
echo "1. Check required env"
test -n "${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}" || fail "Missing https://dggunmqrbimlsuaohkpx.supabase.co"
test -n "${SUPABASE_SERVICE_ROLE_KEY:-}" || fail "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZ3VubXFyYmltbHN1YW9oa3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk5NjEwNSwiZXhwIjoyMDg0NTcyMTA1fQ.4yYB4tcGpKVD7Dm1-hMI4l863m5tUpkgXAWRuogW3sE"
pass "Supabase env exists"

echo ""
echo "2. Check required files"
for f in \
  "src/lib/supabase/service.ts" \
  "src/app/api/admingeneration/db-proof/route.ts" \
  "src/lib/admingeneration/db/editor-repository.ts" \
  "src/app/api/admingeneration/editor/from-analysis/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/timeline/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/versions/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/execute-edit/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/transcript-edits/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/qc/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/export-final/route.ts"
do
  test -f "$f" && pass "$f" || fail "Missing $f"
done

echo ""
echo "3. Check no broken paste / conflict junk"
# Only catch real Git conflict markers or pasted shell commands inside source files.
# Do not flag normal separator strings like "=================================================".
if grep -RIn "^<<<<<<< \|^=======\$\|^>>>>>>> " src/lib src/app/api scripts >/tmp/admingeneration-conflict-scan.txt 2>/dev/null; then
  cat /tmp/admingeneration-conflict-scan.txt
  fail "Found real Git conflict markers inside source"
fi

if grep -RIn "chmod +x scripts/finish\|cat > scripts/finish" src/lib src/app/api >/tmp/admingeneration-junk-scan.txt 2>/dev/null; then
  cat /tmp/admingeneration-junk-scan.txt
  fail "Found pasted shell command junk inside source"
fi

pass "No conflict/junk markers found"

echo ""
echo "4. Check no fake/stub wording in production files"
grep -RIn "fake success\|fake output\|placeholder output\|simulated success\|coming soon\|STUB" \
  src/lib/admingeneration src/app/api/admingeneration \
  && fail "Found fake/stub wording" \
  || pass "No fake/stub wording found"

echo ""
echo "5. Build"
git restore public/build-report.json audit-report.txt 2>/dev/null || true
pnpm build
pass "Production build passed"

echo ""
echo "6. Live DB proof"
if [ "${RUN_LIVE_DB_PROOF:-0}" != "1" ]; then
  echo "ℹ️ Skipping live DB proof. Run with:"
  echo "RUN_LIVE_DB_PROOF=1 ./scripts/finish-and-prove-admingeneration-production.sh"
  exit 0
fi

npx kill-port "${PORT}" >/dev/null 2>&1 || true

pnpm start -- -H 127.0.0.1 -p "${PORT}" > /tmp/admingeneration-proof-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 12

curl -fsS "${BASE_URL}/admingeneration/editor" >/dev/null \
  && pass "Editor page responds" \
  || { cat /tmp/admingeneration-proof-server.log || true; fail "Editor page did not respond"; }

curl -sS -X POST "${BASE_URL}/api/admingeneration/db-proof" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/admingeneration-db-proof.json

grep -q '"status":"db_write_read_proven"' /tmp/admingeneration-db-proof.json \
  && pass "DB write/read route proven" \
  || fail "DB proof route failed"

grep -q '"readBackSegments":1' /tmp/admingeneration-db-proof.json \
  && pass "Timeline segment persisted/read" \
  || fail "Timeline segment not proven"

grep -q '"readBackWords":3' /tmp/admingeneration-db-proof.json \
  && pass "Transcript words persisted/read" \
  || fail "Transcript words not proven"

grep -q '"readBackVersions":1' /tmp/admingeneration-db-proof.json \
  && pass "Version persisted/read" \
  || fail "Version not proven"

PROJECT_ID="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/tmp/admingeneration-db-proof.json','utf8')); console.log(j.projectId)")"

curl -sS "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/timeline" \
  | tee /tmp/admingeneration-timeline-proof.json

grep -q '"segments"' /tmp/admingeneration-timeline-proof.json \
  && pass "DB-backed timeline route reads project data" \
  || fail "DB-backed timeline route failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/execute-edit" \
  -H "Content-Type: application/json" \
  -d '{"action":"segment_edit","targetType":"segment","targetId":"proof-target","instruction":"proof targeted edit"}' \
  | tee /tmp/admingeneration-edit-proof.json

grep -q '"providerRun"' /tmp/admingeneration-edit-proof.json \
  && pass "Targeted edit created provider run/version/edit job" \
  || fail "Targeted edit persistence failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/transcript-edits" \
  -H "Content-Type: application/json" \
  -d '{"editedText":"new proof transcript line","startSec":0,"endSec":2}' \
  | tee /tmp/admingeneration-transcript-proof.json

grep -q '"providerRun"' /tmp/admingeneration-transcript-proof.json \
  && pass "Transcript edit created persisted edit/provider/version" \
  || fail "Transcript edit persistence failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/qc" \
  -H "Content-Type: application/json" \
  -d '{"reason":"proof blocked until real provider output passes QC"}' \
  | tee /tmp/admingeneration-qc-proof.json

grep -q '"status":"blocked"' /tmp/admingeneration-qc-proof.json \
  && pass "QA gate blocks until real provider output passes QC" \
  || fail "QA gate did not block"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/export-final" \
  -H "Content-Type: application/json" \
  -d '{"exportType":"mp4","settings":{"proof":true}}' \
  | tee /tmp/admingeneration-export-proof.json

grep -q '"export"' /tmp/admingeneration-export-proof.json \
  && pass "Export/stitch rows created" \
  || fail "Export persistence failed"

echo "================================================="
echo "✅ FULL PRODUCTION DB PROOF PASSED"
echo "================================================="
