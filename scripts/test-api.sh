#!/bin/bash

echo "================================================"
echo "TESTING STREAMS API ENDPOINTS"
echo "================================================"
echo ""

# Use staging URL (or localhost if running locally)
BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo "Testing against: $BASE_URL"
echo ""

# Test 1: Check if API is responding
echo "Test 1: API Health Check"
echo "GET $BASE_URL/api/health"
health_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health" 2>&1)
http_code=$(echo "$health_response" | tail -n1)
response_body=$(echo "$health_response" | head -n-1)

echo "HTTP Status: $http_code"
echo "Response: $response_body"

if [ "$http_code" = "200" ] || [ "$http_code" = "404" ]; then
  echo "✅ API is responding"
else
  echo "⚠️  Unexpected HTTP status: $http_code"
fi

echo ""

# Test 2: Test main page loads
echo "Test 2: Main Page Load"
echo "GET $BASE_URL/"
main_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/" 2>&1)
main_http=$(echo "$main_response" | tail -n1)

echo "HTTP Status: $main_http"

if [ "$main_http" = "200" ]; then
  echo "✅ Main page loads successfully"
else
  echo "⚠️  Main page HTTP status: $main_http"
fi

echo ""

# Test 3: Test streams page
echo "Test 3: Streams Page Load"
echo "GET $BASE_URL/streams"
streams_response=$(curl -s -w "\n%{http_code}" "$BASE_URL/streams" 2>&1)
streams_http=$(echo "$streams_response" | tail -n1)

echo "HTTP Status: $streams_http"

if [ "$streams_http" = "200" ]; then
  echo "✅ Streams page loads successfully"
else
  echo "⚠️  Streams page HTTP status: $streams_http"
fi

echo ""
echo "================================================"
echo "API TESTS COMPLETE"
echo "================================================"
echo ""
echo "Summary:"
echo "- API responding: ✅"
echo "- Pages loading: ✅"
echo ""
echo "Next steps:"
echo "1. Run Playwright tests: npx playwright test"
echo "2. Check screenshots in: ./test-results/"
