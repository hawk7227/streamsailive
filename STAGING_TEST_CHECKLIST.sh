#!/bin/bash
# STAGING TEST CHECKLIST
# Run this on staging.streamsailive.vercel.app
# Tests all 4 features implemented in this session

echo "============================================"
echo "PHASE 0-2 STAGING TEST CHECKLIST"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0

function test_result() {
  local test_name=$1
  local result=$2
  
  test_count=$((test_count + 1))
  
  if [ "$result" = "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $test_name"
    pass_count=$((pass_count + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $test_name"
  fi
}

echo "PRE-FLIGHT CHECKS"
echo "================="
echo ""
echo "1. Open: https://staging.streamsailive.vercel.app/streams"
echo "2. You should be logged in (if not, login first)"
echo "3. Navigate to Generate tab (✦ icon)"
echo ""
echo "Press ENTER when ready to start tests..."
read

echo ""
echo "FEATURE A: AUTH CONTEXT WIRING"
echo "=============================="
echo ""
echo "Steps:"
echo "1. Open browser DevTools (F12)"
echo "2. Go to Application → Local Storage"
echo "3. Submit a generation (any mode)"
echo ""
echo "Expected results:"
echo "- Job appears in topbar (⟳ N button shows)"
echo "- Job panel shows your actual user ID (not 'placeholder')"
echo "- Job appears in browser console logs with real workspace_id"
echo ""
echo "Result: PASS or FAIL?"
read -p "> " auth_result
test_result "Auth context wiring (real user/workspace IDs)" "$auth_result"

echo ""
echo "FEATURE B: CANCEL BUTTON"
echo "======================="
echo ""
echo "Steps:"
echo "1. Start a long-running generation (T2V mode = ~45 seconds)"
echo "2. Immediately click the red 'Cancel' button on the spinner overlay"
echo "3. Check the job panel - it should show 'cancelled' status"
echo ""
echo "Expected:"
echo "- Button is clickable (not disabled)"
echo "- Job status changes to 'cancelled' in the panel"
echo "- Spinner overlay disappears"
echo ""
echo "Result: PASS or FAIL?"
read -p "> " cancel_result
test_result "Cancel button functionality" "$cancel_result"

echo ""
echo "FEATURE C: PHASE 1 STATUS INDICATORS"
echo "===================================="
echo ""
echo "Steps:"
echo "1. Submit generation in Image mode"
echo "2. Look at spinner overlay while generating"
echo ""
echo "Expected:"
echo "- Says 'Generating image...' (not generic 'Generating Image...')"
echo "- Shows 'Est. 8s' (not dynamic time)"
echo "- Shows 'Cost: \$X.XX' (actual cost for selected model)"
echo ""
echo "Test other modes:"
echo "2a. Voice mode → 'Synthesizing voice...' + 'Est. 10s'"
echo "2b. Music mode → 'Creating music...' + 'Est. 20s'"
echo "2c. T2V mode → 'Generating video...' + 'Est. 45s'"
echo ""
echo "Result: PASS or FAIL?"
read -p "> " status_result
test_result "Mode-specific status messages + costs" "$status_result"

echo ""
echo "FEATURE D: PHASE 2 VIDEO ANALYSIS"
echo "================================="
echo ""
echo "Steps:"
echo "1. Click 'Show video analysis (Phase 2)' button"
echo "2. Paste a YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
echo "3. Click 'Analyze for duplication'"
echo ""
echo "Expected:"
echo "- Loading spinner appears"
echo "- Results show after 2-3 seconds:"
echo "  * Platform: YouTube"
echo "  * Duplication: 0% (YouTube videos are always original)"
echo "  * Confidence: 95%+"
echo "  * Suggested prompt auto-generated"
echo ""
echo "Test with file upload:"
echo "4. Switch to 'Upload' mode"
echo "5. Select a local video file"
echo "6. Click 'Analyze for duplication'"
echo ""
echo "Expected:"
echo "- Results show duplication score (varies by video)"
echo "- Confidence appears"
echo "- No error messages"
echo ""
echo "Error handling test:"
echo "7. Switch to 'URL' mode"
echo "8. Paste invalid URL: 'https://invalid.com/video.mp4'"
echo "9. Click 'Analyze'"
echo ""
echo "Expected:"
echo "- Red error box appears"
echo "- Error message is user-friendly"
echo "- Can retry with different URL"
echo ""
echo "Result: PASS or FAIL?"
read -p "> " video_result
test_result "Phase 2 video analysis (YouTube, upload, error handling)" "$video_result"

echo ""
echo "REGRESSION TESTS"
echo "==============="
echo ""
echo "Steps:"
echo "1. Submit a generation (should still work normally)"
echo "2. Wait for completion"
echo "3. Click the result to open it in player"
echo "4. Refresh the page"
echo ""
echo "Expected:"
echo "- Generation completes normally"
echo "- Player shows result"
echo "- Refresh resumes active jobs from database"
echo "- Job appears in topbar again"
echo ""
echo "Result: PASS or FAIL?"
read -p "> " regression_result
test_result "Generation completion + refresh resume" "$regression_result"

echo ""
echo "============================================"
echo "TEST RESULTS"
echo "============================================"
echo "Passed: $pass_count / $test_count tests"
echo ""

if [ $pass_count -eq $test_count ]; then
  echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
  echo "Ready to deploy to production!"
  exit 0
else
  echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
  echo "Review failures above and file bug reports"
  exit 1
fi
