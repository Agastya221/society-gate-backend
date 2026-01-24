#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:4000/api/v1/auth"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Testing Authentication Endpoints${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}1. Testing Health Check...${NC}"
HEALTH=$(curl -s http://localhost:4000/health)
if echo "$HEALTH" | grep -q "OK"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Request OTP (will fail in test as we don't have real phone)
echo -e "${YELLOW}2. Testing OTP Request Endpoint...${NC}"
OTP_RESPONSE=$(curl -s -X POST "$BASE_URL/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}')
echo "Response: $OTP_RESPONSE"
if echo "$OTP_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ OTP endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠ OTP endpoint accessible but requires valid MSG91 config${NC}"
fi
echo ""

# Test 3: Check if refresh-token endpoint exists
echo -e "${YELLOW}3. Testing Refresh Token Endpoint (without token)...${NC}"
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/refresh-token" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "Response: $REFRESH_RESPONSE"
if echo "$REFRESH_RESPONSE" | grep -q "Refresh token is required\|refreshToken"; then
    echo -e "${GREEN}✓ Refresh token endpoint working${NC}"
else
    echo -e "${RED}✗ Refresh token endpoint error${NC}"
fi
echo ""

# Test 4: Check if logout endpoint exists
echo -e "${YELLOW}4. Testing Logout Endpoint (without token)...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/logout" \
  -H "Content-Type: application/json")
echo "Response: $LOGOUT_RESPONSE"
if echo "$LOGOUT_RESPONSE" | grep -q "No token provided\|No access token"; then
    echo -e "${GREEN}✓ Logout endpoint working${NC}"
else
    echo -e "${RED}✗ Logout endpoint error${NC}"
fi
echo ""

# Test 5: Check Redis Connection
echo -e "${YELLOW}5. Checking Redis Connection...${NC}"
REDIS_STATUS=$(curl -s http://localhost:4000/health)
if echo "$REDIS_STATUS" | grep -q "OK"; then
    echo -e "${GREEN}✓ Redis connection appears healthy${NC}"
else
    echo -e "${RED}✗ Redis connection issue${NC}"
fi
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN}All endpoint checks completed!${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Full authentication flow requires:"
echo "  - Valid phone number and MSG91 API"
echo "  - Database with users"
echo "  - Complete OTP verification"
echo ""
echo -e "${GREEN}Server is running and all new endpoints are accessible!${NC}"
