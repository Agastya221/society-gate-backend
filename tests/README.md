# 🧪 Testing Your Backend - Quick Start

This directory contains test scripts to verify all critical security fixes.

---

## 🚀 Quick Test (5 Minutes)

The fastest way to test the most critical fixes:

### 1. Race Condition Test

```bash
# Install axios if not already installed
npm install axios

# Edit the config in the file with your tokens/IDs
notepad tests\race-condition-test.js

# Run the test
node tests\race-condition-test.js
```

**What it tests:**
- PreApproval QR can only be used up to maxUses
- GatePass QR can only be scanned once
- Concurrent requests are handled atomically

**Expected result:**
```
✅ Test 1 (PreApproval): PASS
✅ Test 2 (GatePass): PASS
✅ All race conditions handled correctly!
```

---

### 2. Society Isolation Test

```bash
# Edit the config with your tokens/IDs
notepad tests\society-isolation-test.js

# Run the test
node tests\society-isolation-test.js
```

**What it tests:**
- Society A admin cannot see Society B data
- Society A admin cannot access Society B specific items
- Cross-society creation is blocked

**Expected result:**
```
✅ Entry Isolation: PASS
✅ Complaint Isolation: PASS
✅ Staff Isolation: PASS
✅ Cross-Creation Block: PASS
```

---

## 📋 Before Running Tests

### Step 1: Get Authentication Tokens

You need valid JWT tokens for testing. Get them by logging in:

```bash
# Login as Guard
POST http://localhost:4000/api/auth/guard/login
{
  "username": "guard1",
  "password": "password"
}
# Copy the token from response

# Login as Resident
POST http://localhost:4000/api/auth/resident/verify-otp
{
  "phone": "+919876543210",
  "otp": "123456"
}
# Copy the token from response
```

Or use Postman/Thunder Client in VS Code to get tokens.

### Step 2: Create Test Data

Before running race condition tests, you need:

**For PreApproval test:**
1. Login as resident
2. Create a pre-approval with maxUses = 3
3. Get the QR token from response
4. Get your flatId and societyId

**For GatePass test:**
1. Login as resident
2. Create a gate pass
3. Get admin to approve it
4. Get the QR code from response

**For Society Isolation test:**
1. Have 2 different societies in database
2. Get admin tokens for both
3. Create some entries/complaints in Society B
4. Note down the IDs

---

## 🔧 Configuration Example

Edit `tests/race-condition-test.js`:

```javascript
const CONFIG = {
  apiBase: 'http://localhost:4000',
  guardToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // Your actual token

  preApproval: {
    qrToken: 'PRE_abc123xyz',  // From pre-approval creation response
    flatId: 'flat-uuid-here',
    societyId: 'society-uuid-here',
    expectedMaxUses: 3,
  },

  gatePass: {
    qrCode: 'GATE_def456uvw',  // From gate pass QR response
    guardId: 'guard-uuid-here',
  },
};
```

---

## 🎯 What Each Test Does

### Race Condition Test

**Sends 10 concurrent requests** to scan the same QR code:

- **PreApproval (maxUses=3):** Only 3 should succeed, 7 should fail with "maximum uses"
- **GatePass (single use):** Only 1 should succeed, 9 should fail with "already been used"

This proves the atomic operations are working correctly.

### Society Isolation Test

**Tests multi-tenancy boundaries:**

1. Admin A lists entries → Should NOT see Society B entries
2. Admin A tries to access Society B entry by ID → Should get 403/404
3. Admin A tries to create staff for Society B → Should be blocked
4. Same for complaints, domestic staff, etc.

This proves ensureSameSociety middleware is working.

---

## 📊 Understanding Results

### ✅ PASS - Everything Working
```
✅ Test 1 (PreApproval): PASS
✅ Test 2 (GatePass): PASS
```
Your race conditions are fixed correctly!

### ❌ FAIL - Issue Detected
```
❌ Test 1 (PreApproval): FAIL
   Expected: ≤3 success, ≥7 'max uses' errors
   Got: 5 success, 5 'max uses' errors
```
Race condition still exists - review the fix in preapproval.service.ts

### ⚠️ ERROR - Configuration Issue
```
❌ ERROR: Please update the CONFIG object
```
You need to set valid tokens and IDs in the test file.

---

## 🐛 Troubleshooting

### "Network Error" or "ECONNREFUSED"
**Problem:** Backend server not running

**Solution:**
```bash
npm start
# Or
npm run dev
```

### "401 Unauthorized"
**Problem:** Invalid or expired token

**Solution:**
- Get a fresh token by logging in again
- Tokens expire (Guards: 7 days, Residents: 30 days)

### "404 Not Found"
**Problem:** Wrong API endpoint or ID doesn't exist

**Solution:**
- Check API_BASE in config (should be http://localhost:4000)
- Verify the IDs exist in database
- Check route structure (v1 vs legacy routes)

### All requests succeed (more than maxUses)
**Problem:** Race condition fix not working

**Solution:**
- Check database: `SELECT usedCount, maxUses FROM "PreApproval" WHERE id = 'xxx'`
- If usedCount > maxUses, the atomic fix isn't working
- Review preapproval.service.ts lines 335-377

### Can see other society's data
**Problem:** ensureSameSociety not applied

**Solution:**
- Check the route file has: `router.use(ensureSameSociety)`
- Must come AFTER `router.use(authenticate)`
- Check all route files listed in FINAL_SECURITY_AUDIT.md

---

## 📝 Full Test Suite

For comprehensive testing:

```bash
# Install test dependencies
npm install --save-dev jest supertest

# Run all unit tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## 🎓 Advanced Testing

### Load Testing with Artillery

```bash
# Install Artillery
npm install -g artillery

# Edit artillery test
notepad tests\load-test.yml

# Run load test
artillery run tests\load-test.yml
```

### Load Testing with k6

```bash
# Install k6 from https://k6.io/

# Run k6 test
k6 run tests\gatepass-race.js
```

---

## ✅ Pre-Deployment Checklist

Run these tests before deploying to production:

- [ ] Race condition test passes (both PreApproval and GatePass)
- [ ] Society isolation test passes (all 4 sub-tests)
- [ ] Entry approval authorization works (manual test)
- [ ] Midnight time validation works (if you have auto-approve rules)
- [ ] Family member limit enforced (try inviting 7 members)
- [ ] Flat owner validation works (try approving 2 owners)
- [ ] Real-time notifications work (test Socket.IO)
- [ ] All critical workflows tested end-to-end

---

## 📚 Full Testing Guide

For detailed testing strategies, see [TESTING_GUIDE.md](../TESTING_GUIDE.md)

---

## 🆘 Need Help?

If tests are failing:

1. **Check server logs** - Look for errors in console
2. **Check database** - Verify data exists and is correct
3. **Review the fix** - Check the code changes in service files
4. **Test manually** - Use Postman to test one request at a time
5. **Check middleware** - Ensure authenticate and ensureSameSociety are applied

---

**Good luck with testing!** 🚀

Once all tests pass, you're ready to deploy to production.
