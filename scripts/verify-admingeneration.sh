#!/usr/bin/env bash
set -euo pipefail

echo "================================================="
echo " /admingeneration production slice verification"
echo "================================================="

fail() {
  echo "❌ FAIL: $1"
  exit 1
}

pass() {
  echo "✅ PASS: $1"
}

check_file() {
  test -f "$1" || fail "missing file: $1"
  pass "file exists: $1"
}

check_grep() {
  local pattern="$1"
  local file="$2"
  local label="$3"
  grep -q "$pattern" "$file" || fail "$label missing in $file"
  pass "$label"
}

APP_FILE="components/streams/opus-frame/OpusLockedFrame.jsx"
CSS_FILE="components/streams/opus-frame/opus-locked-frame.css"
GUARD_FILE="components/streams/opus-frame/AdminGenerationRuntimeGuard.jsx"
PAGE_FILE="src/app/admingeneration/page.jsx"
VOICE_FILE="components/streams/opus-frame/VoiceConversationLayer.jsx"
WAKE_FILE="components/streams/opus-frame/WakeWordLayer.jsx"
VOICE_CSS_FILE="components/streams/opus-frame/voice-conversation-layer.css"

echo ""
echo "1. Source files"
check_file "$APP_FILE"
check_file "$CSS_FILE"
check_file "$GUARD_FILE"
check_file "$PAGE_FILE"
check_file "$VOICE_FILE"
check_file "$WAKE_FILE"
check_file "$VOICE_CSS_FILE"
check_file "src/app/api/admingeneration/voice/session/route.ts"
check_file "src/app/api/admingeneration/voice/memory/route.ts"
check_file "src/app/api/voice/vapi-webhook/route.ts"
check_file "src/lib/voice/vapi-webhook.ts"
check_file "src/app/api/admingeneration/jobs/route.ts"
check_file "src/app/api/admingeneration/helper/route.ts"
check_file "src/app/api/admingeneration/intake/route.ts"
check_file "src/app/api/admingeneration/submit/route.ts"

if [ -f "src/app/api/admingeneration/research/route.ts" ]; then
  pass "research wrapper exists"
else
  echo "⚠️ WARN: research wrapper missing: src/app/api/admingeneration/research/route.ts"
fi

echo ""
echo "2. Frontend feature wiring"
check_grep "AdminGenerationRuntimeGuard" "$PAGE_FILE" "page renders secure runtime guard"
check_grep "OpusLockedFrame" "$GUARD_FILE" "guard renders Opus frame"
check_grep "/api/admingeneration/jobs" "$GUARD_FILE" "guard intercepts protected jobs route"
check_grep "/api/admingeneration/submit" "$GUARD_FILE" "guard rewrites generation to secure submit wrapper"

check_grep "Advanced Prompt Builder" "$APP_FILE" "right-side advanced prompt builder"
check_grep "right-advanced-builder" "$APP_FILE" "right advanced builder container"
check_grep "Main Prompt" "$APP_FILE" "main prompt field"
check_grep "Scene Description" "$APP_FILE" "scene description field"
check_grep "Subject" "$APP_FILE" "subject field"
check_grep "Environment" "$APP_FILE" "environment field"
check_grep "Emotional Intent" "$APP_FILE" "emotional intent field"
check_grep "Camera" "$APP_FILE" "camera section"
check_grep "Lighting" "$APP_FILE" "lighting section"
check_grep "Motion" "$APP_FILE" "motion section"
check_grep "Style" "$APP_FILE" "style section"
check_grep "Negative Prompt" "$APP_FILE" "negative prompt section"
check_grep "Audio / Voice" "$APP_FILE" "audio/voice section"
check_grep "Output Settings" "$APP_FILE" "output settings section"

check_grep "helper-drawer-backdrop" "$APP_FILE" "AI helper drawer"
check_grep "AI Helper / Analyzer Console" "$APP_FILE" "AI helper console title"
check_grep "helperMessages" "$APP_FILE" "helper chat state"
check_grep "askHelper" "$APP_FILE" "helper conversation sender"
check_grep "/api/admingeneration/helper" "$APP_FILE" "helper backend route call"

check_grep "startVoice" "$APP_FILE" "voice start function"
check_grep "stopVoice" "$APP_FILE" "voice stop function"
check_grep "MediaRecorder" "$APP_FILE" "MediaRecorder voice capture"
check_grep "navigator.mediaDevices.getUserMedia" "$APP_FILE" "browser mic/camera access"
check_grep "/api/voice/transcribe" "$APP_FILE" "voice transcription route"
check_grep "/api/voice/speak" "$APP_FILE" "voice speak route"

check_grep "analyzeUrl" "$APP_FILE" "URL analyzer function"
check_grep "/api/admingeneration/intake" "$APP_FILE" "intake wrapper call"
check_grep "uploadFiles" "$APP_FILE" "file upload handler"
check_grep "type=\"file\"" "$APP_FILE" "file input exists"
check_grep "accept=\"video/\*,image/\*,audio/\*" "$APP_FILE" "video/image/audio upload accepts"

check_grep "proofPrompt" "$APP_FILE" "prompt proof function"
check_grep "openCameraGuide" "$APP_FILE" "camera/mic guide function"
check_grep "activeStudio.guide" "$APP_FILE" "per-card user guide wiring"
check_grep "setHelperOpen(false)" "$APP_FILE" "helper close wiring"
check_grep "stopPropagation" "$APP_FILE" "drawer click-out protection"
check_grep "Escape" "$APP_FILE" "Escape close wiring"
check_grep "VoiceConversationLayer" "$GUARD_FILE" "guard renders voice conversation layer"
check_grep "@vapi-ai/web" "$VOICE_FILE" "voice layer uses Vapi SDK"
check_grep "/api/admingeneration/voice/session" "$VOICE_FILE" "voice layer loads voice session config"
check_grep "/api/admingeneration/voice/memory" "$VOICE_FILE" "voice layer persists transcripts"
check_grep "vapi.start" "$VOICE_FILE" "voice layer starts Vapi call"
check_grep "message" "$VOICE_FILE" "voice layer receives Vapi message events"
check_grep "@picovoice/porcupine-web" "$WAKE_FILE" "wake layer uses Picovoice Porcupine"
check_grep "@picovoice/web-voice-processor" "$WAKE_FILE" "wake layer uses WebVoiceProcessor"
check_grep "PorcupineWorker" "$WAKE_FILE" "wake layer creates Porcupine worker"
check_grep "Hey Streams" "$WAKE_FILE" "wake layer listens for Hey Streams"
check_grep "NEXT_PUBLIC_VAPI_PUBLIC_KEY" "src/app/api/admingeneration/voice/session/route.ts" "voice session checks Vapi public key"
check_grep "NEXT_PUBLIC_VAPI_ASSISTANT_ID" "src/app/api/admingeneration/voice/session/route.ts" "voice session checks Vapi assistant id"
check_grep "PICOVOICE_ACCESS_KEY" "src/app/api/admingeneration/voice/session/route.ts" "voice session checks Picovoice key"
check_grep "NEXT_PUBLIC_PICOVOICE_WAKEWORD_MODEL_PATH" "src/app/api/admingeneration/voice/session/route.ts" "voice session checks wakeword model path"
check_grep "VAPI_WEBHOOK_SECRET" "src/app/api/voice/vapi-webhook/route.ts" "vapi webhook route verifies webhook secret"
check_grep "verifyVapiWebhookRequest" "src/lib/voice/vapi-webhook.ts" "vapi webhook signature helper exists"
check_grep "normalizeVapiWebhookEvent" "src/lib/voice/vapi-webhook.ts" "vapi webhook normalizer exists"
check_grep "/api/admingeneration/voice/memory" "src/app/api/voice/vapi-webhook/route.ts" "vapi webhook forwards to voice memory"
check_grep "/api/streams-ai/messages" "src/app/api/voice/vapi-webhook/route.ts" "vapi webhook forwards to STREAMS messages"
check_grep "/api/streams/chat" "src/app/api/voice/vapi-webhook/route.ts" "vapi webhook forwards to STREAMS chat"
check_grep "durableSourceOfTruth" "src/app/api/voice/vapi-webhook/route.ts" "vapi webhook marks server event durable source"

echo ""
echo "3. CSS/layout wiring"
check_grep "right-advanced-builder" "$CSS_FILE" "advanced builder CSS"
check_grep "helper-drawer-backdrop" "$CSS_FILE" "helper drawer CSS"
check_grep "helper-drawer-thread" "$CSS_FILE" "helper chat thread CSS"
check_grep "helper-drawer-composer" "$CSS_FILE" "helper composer CSS"
check_grep "camera-modal-backdrop" "$CSS_FILE" "camera modal CSS"
check_grep "preview-layout" "$CSS_FILE" "preview layout CSS"
check_grep "video-shell" "$CSS_FILE" "preview player CSS"
check_grep "timeline-card" "$CSS_FILE" "timeline CSS"

echo ""
echo "4. Backend route source checks"
check_grep "OPENAI_API_KEY" "src/app/api/admingeneration/helper/route.ts" "helper uses server-side OpenAI key"
check_grep "https://api.openai.com/v1/responses" "src/app/api/admingeneration/helper/route.ts" "helper uses OpenAI Responses API"
check_grep "POST" "src/app/api/admingeneration/helper/route.ts" "helper POST handler"
check_grep "/api/intake/youtube" "src/app/api/admingeneration/intake/route.ts" "intake routes YouTube"
check_grep "ADMIN_GENERATION_KEY" "src/app/api/admingeneration/intake/route.ts" "admingeneration intake injects admin key"
check_grep "x-admin-generation-key" "src/app/api/admingeneration/intake/route.ts" "admingeneration intake forwards admin key header"
check_grep "STREAMS_INTAKE_KEY" "src/app/api/admingeneration/intake/route.ts" "admingeneration intake supports intake key"
check_grep "/api/intake/website" "src/app/api/admingeneration/intake/route.ts" "intake routes website"
check_grep "/api/streams/reference/analyze" "src/app/api/admingeneration/intake/route.ts" "intake routes reference analyzer"
check_grep "/api/streams/upload" "src/app/api/admingeneration/intake/route.ts" "intake routes upload"
check_grep "/api/streams/video/ingest" "src/app/api/admingeneration/intake/route.ts" "intake routes video ingest"
check_grep "ADMIN_GENERATION_KEY" "src/app/api/admingeneration/jobs/route.ts" "jobs route enforces admin key"
check_grep "x-admin-generation-key" "src/app/api/admingeneration/jobs/route.ts" "jobs route accepts admin key header"
check_grep "ADMIN_GENERATION_KEY" "src/app/api/admingeneration/submit/route.ts" "submit wrapper reads admin key server-side"
check_grep "x-admin-generation-key" "src/app/api/admingeneration/submit/route.ts" "submit wrapper injects admin key header"
check_grep "/api/admingeneration/jobs" "src/app/api/admingeneration/submit/route.ts" "submit wrapper forwards to jobs route"

echo ""
echo "5. Build verification"
pnpm build
git restore public/build-report.json audit-report.txt 2>/dev/null || true
pass "pnpm build completed"

echo ""
echo "6. Git status"
git status --short
pass "verification complete"
