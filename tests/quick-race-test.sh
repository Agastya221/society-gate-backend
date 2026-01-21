#!/bin/bash

# Quick Race Condition Test Script
# Tests PreApproval and GatePass QR scanning under concurrent load

echo "🧪 Quick Race Condition Testing"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:4000"
GUARD_TOKEN="YOUR_GUARD_TOKEN_HERE"
QR_TOKEN="YOUR_QR_TOKEN_HERE"
FLAT_ID="YOUR_FLAT_ID_HERE"
SOCIETY_ID="YOUR_SOCIETY_ID_HERE"

echo ""
echo "⚙️  Configuration:"
echo "   API: $API_BASE"
echo "   Testing with 10 concurrent requests"
echo ""

# Test 1: PreApproval QR Scan Race Condition
echo "📋 TEST 1: PreApproval QR Scan Race Condition"
echo "   Objective: Only maxUses should succeed, rest should fail"
echo ""

# Create temporary file for results
TEMP_FILE=$(mktemp)

# Run 10 concurrent scans
echo "   Sending 10 concurrent scan requests..."
for i in {1..10}; do
  curl -s -X POST "$API_BASE/api/preapprovals/scan" \
    -H "Authorization: Bearer $GUARD_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"qrToken\":\"$QR_TOKEN\",\"flatId\":\"$FLAT_ID\",\"societyId\":\"$SOCIETY_ID\"}" \
    >> "$TEMP_FILE" &
done

# Wait for all to complete
wait

echo "   ✅ All requests completed"
echo ""

# Analyze results
SUCCESS_COUNT=$(grep -c '"success":true' "$TEMP_FILE")
FAILURE_COUNT=$(grep -c '"success":false' "$TEMP_FILE")
MAX_USES_ERROR=$(grep -c "maximum uses" "$TEMP_FILE")

echo "   📊 Results:"
echo "      Successful scans: $SUCCESS_COUNT"
echo "      Failed scans: $FAILURE_COUNT"
echo "      Max uses errors: $MAX_USES_ERROR"
echo ""

# Validate
if [ "$SUCCESS_COUNT" -le 3 ] && [ "$MAX_USES_ERROR" -ge 7 ]; then
  echo -e "   ${GREEN}✅ PASS${NC} - Race condition handled correctly!"
else
  echo -e "   ${RED}❌ FAIL${NC} - Race condition detected!"
  echo "   Expected: 1-3 success, 7+ 'max uses' errors"
fi

# Cleanup
rm "$TEMP_FILE"

echo ""
echo "================================"
echo ""

# Test 2: GatePass Scan Race Condition
echo "📋 TEST 2: GatePass Scan Race Condition"
echo "   Objective: Only 1 scan should succeed, rest should fail"
echo ""

GATE_PASS_QR="YOUR_GATE_PASS_QR_HERE"
TEMP_FILE2=$(mktemp)

echo "   Sending 10 concurrent scan requests..."
for i in {1..10}; do
  curl -s -X POST "$API_BASE/api/gatepasses/scan" \
    -H "Authorization: Bearer $GUARD_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"qrCode\":\"$GATE_PASS_QR\",\"guardId\":\"$GUARD_ID\"}" \
    >> "$TEMP_FILE2" &
done

wait

echo "   ✅ All requests completed"
echo ""

# Analyze results
GP_SUCCESS=$(grep -c '"success":true' "$TEMP_FILE2")
GP_FAILURE=$(grep -c '"success":false' "$TEMP_FILE2")
ALREADY_USED=$(grep -c "already been used" "$TEMP_FILE2")

echo "   📊 Results:"
echo "      Successful scans: $GP_SUCCESS"
echo "      Failed scans: $GP_FAILURE"
echo "      'Already used' errors: $ALREADY_USED"
echo ""

# Validate
if [ "$GP_SUCCESS" -eq 1 ] && [ "$ALREADY_USED" -ge 9 ]; then
  echo -e "   ${GREEN}✅ PASS${NC} - Race condition handled correctly!"
else
  echo -e "   ${RED}❌ FAIL${NC} - Race condition detected!"
  echo "   Expected: 1 success, 9 'already used' errors"
fi

rm "$TEMP_FILE2"

echo ""
echo "================================"
echo ""
echo "🎉 Testing Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Review results above"
echo "   2. If any tests failed, check server logs"
echo "   3. Run full test suite: npm test"
echo "   4. Test with Artillery for detailed metrics"
echo ""
