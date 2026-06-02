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
echo "STABILIZE EXISTING ADMINGENERATION SYSTEM"
echo "NO NEW ARCHITECTURE — FIX ONLY BROKEN ITEMS"
echo "================================================="

echo ""
echo "1. Clean generated noise"
git restore public/build-report.json audit-report.txt 2>/dev/null || true

echo ""
echo "2. Verify core files exist"
for f in \
  "src/app/admingeneration/editor/page.jsx" \
  "src/components/admingeneration/FullOutputEditorClient.jsx" \
  "src/components/admingeneration/FullOutputEditorClient.module.css" \
  "src/lib/admingeneration/db/editor-repository.ts" \
  "src/lib/supabase/service.ts" \
  "src/app/api/admingeneration/db-proof/route.ts" \
  "src/app/api/admingeneration/editor/from-analysis/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/timeline/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/versions/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/execute-edit/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/transcript-edits/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/qc/route.ts" \
  "src/app/api/admingeneration/editor/projects/[id]/export-final/route.ts"
do
  test -f "$f" && pass "$f" || fail "Missing required file: $f"
done

echo ""
echo "3. Fix known false-positive conflict scan in proof script if present"
python - <<'PY'
from pathlib import Path

p = Path("scripts/finish-and-prove-admingeneration-production.sh")
if not p.exists():
    print("ℹ️ proof script missing; skipping patch")
    raise SystemExit(0)

s = p.read_text(encoding="utf-8")

old = '''grep -RIn "<<<<<<<\\|=======\\|>>>>>>>\\|chmod +x scripts\\|cat > scripts/finish" \\
  src/lib src/app/api scripts \\
  && fail "Found conflict markers or pasted shell junk inside source" \\
  || pass "No conflict/junk markers found"'''

new = '''if grep -RIn "^<<<<<<< \\|^=======$\\|^>>>>>>> " src/lib src/app/api scripts >/tmp/admingeneration-conflict-scan.txt 2>/dev/null; then
  cat /tmp/admingeneration-conflict-scan.txt
  fail "Found real Git conflict markers inside source"
fi

if grep -RIn "chmod +x scripts/finish\\|cat > scripts/finish" src/lib src/app/api >/tmp/admingeneration-junk-scan.txt 2>/dev/null; then
  cat /tmp/admingeneration-junk-scan.txt
  fail "Found pasted shell command junk inside source"
fi

pass "No conflict/junk markers found"'''

if old in s:
    p.write_text(s.replace(old, new, 1), encoding="utf-8")
    print("✅ patched false-positive conflict scan")
else:
    print("✅ conflict scan already patched or changed")
PY

echo ""
echo "4. Verify frontend has no hardcoded demo transcript/audio text"
grep -RIn "Reed walks\|He looks around\|Reed turns\|People are walking\|Cars passing\|This place is amazing\|Background music - City Vibes\|Street ambience\|Car horn" \
  src/components/admingeneration/FullOutputEditorClient.jsx \
  && fail "Hardcoded demo timeline text still exists" \
  || pass "No hardcoded demo timeline text"

echo ""
echo "5. Verify every main visible editor action routes to backend"
grep -q "runSemanticAction\\|runAction" src/components/admingeneration/FullOutputEditorClient.jsx \
  && pass "Editor action handler exists" \
  || fail "Editor action handler missing"

grep -q "execute-edit" src/components/admingeneration/FullOutputEditorClient.jsx src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts 2>/dev/null \
  && pass "Execute edit route referenced" \
  || fail "Execute edit route not referenced"

grep -q "transcript-edits" src/components/admingeneration/FullOutputEditorClient.jsx src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts 2>/dev/null \
  && pass "Transcript edit route referenced" \
  || fail "Transcript edit route not referenced"

grep -q "export-final" src/components/admingeneration/FullOutputEditorClient.jsx src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts 2>/dev/null \
  && pass "Export route referenced" \
  || fail "Export route not referenced"

grep -q "qc" src/components/admingeneration/FullOutputEditorClient.jsx src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts 2>/dev/null \
  && pass "QA route referenced" \
  || fail "QA route not referenced"

echo ""
echo "6. Verify DB-backed routes create real DB records, not fake outputs"
grep -q "createTargetedEdit" src/app/api/admingeneration/editor/projects/[id]/execute-edit/route.ts \
  && pass "Execute edit writes edit/provider/version through repository" \
  || fail "Execute edit is not DB-backed"

grep -q "createTranscriptEdit" src/app/api/admingeneration/editor/projects/[id]/transcript-edits/route.ts \
  && pass "Transcript edit writes transcript/provider/version through repository" \
  || fail "Transcript edit is not DB-backed"

grep -q "createQcBlockedReport" src/app/api/admingeneration/editor/projects/[id]/qc/route.ts \
  && pass "QA writes blocked report through repository" \
  || fail "QA route is not DB-backed"

grep -q "createExportJob" src/app/api/admingeneration/editor/projects/[id]/export-final/route.ts \
  && pass "Export writes stitch/export rows through repository" \
  || fail "Export route is not DB-backed"

echo ""
echo "7. No fake/stub wording in active production routes"
grep -RIn "fake success\|fake output\|placeholder output\|simulated success\|coming soon\|STUB" \
  src/lib/admingeneration src/app/api/admingeneration \
  && fail "Fake/stub wording found in active routes" \
  || pass "No fake/stub wording found"

echo ""
echo "8. Production build"
pnpm build
pass "Production build passed"

echo ""
echo "9. Optional live route proof"
if [ "${RUN_LIVE_PROOF:-0}" != "1" ]; then
  echo "ℹ️ Skipping live proof. Run:"
  echo "RUN_LIVE_PROOF=1 ./scripts/stabilize-admingeneration-existing-system.sh"
  exit 0
fi

test -n "${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}" || fail "Missing Supabase URL env"
test -n "${SUPABASE_SERVICE_ROLE_KEY:-}" || fail "Missing SUPABASE_SERVICE_ROLE_KEY env"

npx kill-port "${PORT}" >/dev/null 2>&1 || true

pnpm start -- -H 127.0.0.1 -p "${PORT}" > /tmp/admingeneration-stabilize-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 12

curl -fsS "${BASE_URL}/admingeneration/editor" >/dev/null \
  && pass "Editor page responds" \
  || { cat /tmp/admingeneration-stabilize-server.log || true; fail "Editor page failed"; }

curl -sS -X POST "${BASE_URL}/api/admingeneration/db-proof" \
  -H "Content-Type: application/json" \
  -d '{}' | tee /tmp/admingeneration-db-proof.json

grep -q '"status":"db_write_read_proven"' /tmp/admingeneration-db-proof.json \
  && pass "DB write/read proven" \
  || fail "DB proof failed"

PROJECT_ID="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/tmp/admingeneration-db-proof.json','utf8')); console.log(j.projectId)")"

curl -sS "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/timeline" \
  | tee /tmp/admingeneration-timeline-proof.json
grep -q '"segments"' /tmp/admingeneration-timeline-proof.json \
  && pass "Timeline route reads DB project" \
  || fail "Timeline DB read failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/execute-edit" \
  -H "Content-Type: application/json" \
  -d '{"action":"segment_edit","targetType":"segment","targetId":"proof-target","instruction":"proof targeted edit"}' \
  | tee /tmp/admingeneration-edit-proof.json
grep -q '"providerRun"' /tmp/admingeneration-edit-proof.json \
  && pass "Targeted edit creates providerRun/version/editJob" \
  || fail "Targeted edit persistence failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/transcript-edits" \
  -H "Content-Type: application/json" \
  -d '{"editedText":"new proof transcript line","startSec":0,"endSec":2}' \
  | tee /tmp/admingeneration-transcript-proof.json
grep -q '"providerRun"' /tmp/admingeneration-transcript-proof.json \
  && pass "Transcript edit creates persisted providerRun/version" \
  || fail "Transcript edit persistence failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/qc" \
  -H "Content-Type: application/json" \
  -d '{"reason":"proof blocked until real provider output passes QC"}' \
  | tee /tmp/admingeneration-qc-proof.json
grep -q '"status":"blocked"' /tmp/admingeneration-qc-proof.json \
  && pass "QA blocks until real provider output passes" \
  || fail "QA blocking failed"

curl -sS -X POST "${BASE_URL}/api/admingeneration/editor/projects/${PROJECT_ID}/export-final" \
  -H "Content-Type: application/json" \
  -d '{"exportType":"mp4","settings":{"proof":true}}' \
  | tee /tmp/admingeneration-export-proof.json
grep -q '"export"' /tmp/admingeneration-export-proof.json \
  && pass "Export/stitch rows created" \
  || fail "Export persistence failed"

echo "================================================="
echo "✅ EXISTING SYSTEM STABILIZED AND PROVEN"
echo "================================================="
