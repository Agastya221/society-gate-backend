# 🧪 COMPREHENSIVE TESTING GUIDE - All Critical Fixes

**Purpose:** Verify all security fixes work correctly, especially under concurrent load
**Focus:** Race conditions, authorization checks, society isolation

---

## 📋 TESTING CHECKLIST

### Priority 1: Critical Security Fixes
- [ ] Entry approval authorization (flat ownership)
- [ ] PreApproval QR scan race condition
- [ ] GatePass scan race condition
- [ ] Entry service pre-approval race condition
- [ ] Expected delivery race condition
- [ ] Society isolation (ensureSameSociety)

### Priority 2: Business Logic Fixes
- [ ] Time validation (midnight-spanning rules)
- [ ] Family member counting
- [ ] Flat owner validation

### Priority 3: General Functionality
- [ ] All core workflows end-to-end
- [ ] Real-time notifications
- [ ] File uploads

---

## 🔧 TESTING TOOLS SETUP

### 1. Install Testing Tools

```bash
# Install required packages
npm install --save-dev artillery k6 jest supertest @types/jest @types/supertest

# Or use standalone tools
npm install -g artillery  # For load testing
npm install -g k6         # Alternative load testing
```

### 2. Environment Setup

```bash
# Create test environment file
cp .env .env.test

# Update .env.test with test database
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/society_gate_test"
```

---

## 🎯 TEST 1: Entry Approval Authorization

### Objective
Verify that residents can ONLY approve entries for their own flat.

### Manual Test

```bash
# Step 1: Create two residents in different flats
# Resident A - Flat 101
# Resident B - Flat 102

# Step 2: Guard creates entry for Flat 101
POST /api/v1/entries
Authorization: Bearer <GUARD_TOKEN>
{
  "type": "VISITOR",
  "flatId": "<flat-101-id>",
  "visitorName": "John Doe",
  "visitorPhone": "+919876543210"
}

# Save entry ID from response

# Step 3: Try to approve with Resident B (should FAIL)
PATCH /api/v1/entries/<entry-id>/approve
Authorization: Bearer <RESIDENT_B_TOKEN>

# Expected: 403 Forbidden
# Message: "You are not authorized to approve entries for this flat"

# Step 4: Approve with Resident A (should SUCCEED)
PATCH /api/v1/entries/<entry-id>/approve
Authorization: Bearer <RESIDENT_A_TOKEN>

# Expected: 200 OK
```

### Automated Test Script

Create `tests/authorization.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/app');

describe('Entry Approval Authorization', () => {
  let guardToken, residentAToken, residentBToken;
  let flat101Id, flat102Id, entryId;

  beforeAll(async () => {
    // Login and get tokens
    guardToken = await getGuardToken();
    residentAToken = await getResidentToken('flat-101');
    residentBToken = await getResidentToken('flat-102');
  });

  test('Should prevent resident from approving another flat entry', async () => {
    // Create entry for Flat 101
    const entryRes = await request(app)
      .post('/api/v1/entries')
      .set('Authorization', `Bearer ${guardToken}`)
      .send({
        type: 'VISITOR',
        flatId: flat101Id,
        visitorName: 'Test Visitor'
      });

    entryId = entryRes.body.data.id;

    // Try to approve with Resident B (different flat)
    const approveRes = await request(app)
      .patch(`/api/v1/entries/${entryId}/approve`)
      .set('Authorization', `Bearer ${residentBToken}`);

    expect(approveRes.status).toBe(403);
    expect(approveRes.body.message).toContain('not authorized');
  });

  test('Should allow resident to approve their own flat entry', async () => {
    const approveRes = await request(app)
      .patch(`/api/v1/entries/${entryId}/approve`)
      .set('Authorization', `Bearer ${residentAToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
  });
});
```

---

## 🏃‍♂️ TEST 2: PreApproval QR Scan Race Condition

### Objective
Verify that a pre-approval QR can only be used up to maxUses, even with concurrent scans.

### Load Test Script (Artillery)

Create `tests/preapproval-race.yml`:

```yaml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 10
      arrivalRate: 5  # 5 concurrent requests per second
      name: "Race condition test"
  processor: "./preapproval-processor.js"

scenarios:
  - name: "Scan Pre-Approval QR Concurrently"
    flow:
      - post:
          url: "/api/preapprovals/scan"
          headers:
            Authorization: "Bearer {{ guardToken }}"
            Content-Type: "application/json"
          json:
            qrToken: "{{ preApprovalQR }}"
            flatId: "{{ flatId }}"
            societyId: "{{ societyId }}"
          capture:
            - json: "$.success"
              as: "success"
            - json: "$.message"
              as: "message"
      - log: "Response: {{ success }} - {{ message }}"
```

Create `tests/preapproval-processor.js`:

```javascript
module.exports = {
  setJSONBody: function(requestParams, context, ee, next) {
    return next();
  },
  beforeRequest: function(requestParams, context, ee, next) {
    // Set guard token and pre-approval details
    context.vars.guardToken = 'YOUR_GUARD_TOKEN';
    context.vars.preApprovalQR = 'TEST_QR_TOKEN';
    context.vars.flatId = 'TEST_FLAT_ID';
    context.vars.societyId = 'TEST_SOCIETY_ID';
    return next();
  }
};
```

Run test:

```bash
artillery run tests/preapproval-race.yml
```

### Expected Results

```
Scenario: Scan Pre-Approval QR Concurrently
  - Total requests: 50
  - Successful scans: 3 (if maxUses = 3)
  - Failed scans: 47
  - Error message: "Pre-approval has reached maximum uses"
```

### Manual Concurrent Test (Using curl)

```bash
#!/bin/bash
# Create pre-approval with maxUses = 3
# Get QR token

GUARD_TOKEN="your-guard-token"
QR_TOKEN="your-qr-token"
FLAT_ID="flat-id"
SOCIETY_ID="society-id"

# Run 10 concurrent scans (only 3 should succeed)
for i in {1..10}; do
  curl -X POST http://localhost:4000/api/preapprovals/scan \
    -H "Authorization: Bearer $GUARD_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"qrToken\":\"$QR_TOKEN\",\"flatId\":\"$FLAT_ID\",\"societyId\":\"$SOCIETY_ID\"}" &
done

wait
echo "All requests completed"
```

---

## 🎫 TEST 3: GatePass Scan Race Condition

### Objective
Verify that a gate pass QR can only be scanned once, even with concurrent scans.

### Load Test Script (k6)

Create `tests/gatepass-race.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 10, // 10 virtual users
  duration: '5s',
};

const GUARD_TOKEN = __ENV.GUARD_TOKEN;
const GATE_PASS_QR = __ENV.GATE_PASS_QR;
const GUARD_ID = __ENV.GUARD_ID;

export default function() {
  const url = 'http://localhost:4000/api/gatepasses/scan';
  const payload = JSON.stringify({
    qrCode: GATE_PASS_QR,
    guardId: GUARD_ID,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GUARD_TOKEN}`,
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    'only one succeeds': (r) => {
      if (r.status === 200) {
        console.log('✅ Scan succeeded');
        return true;
      } else if (r.json('message').includes('already been used')) {
        console.log('❌ Already used (expected)');
        return true;
      }
      return false;
    },
  });
}
```

Run test:

```bash
GUARD_TOKEN="token" GATE_PASS_QR="qr" GUARD_ID="id" k6 run tests/gatepass-race.js
```

### Expected Results

```
✅ Scan succeeded (1 time)
❌ Already used (9 times)

checks.........................: 100.00% ✓ 10
http_req_duration..............: avg=45ms
http_reqs......................: 10
```

---

## 🏢 TEST 4: Society Isolation (ensureSameSociety)

### Objective
Verify that admins/residents from Society A cannot access Society B's data.

### Test Matrix

| Endpoint | Society A User | Society B Data | Expected |
|----------|----------------|----------------|----------|
| GET /api/entries | Admin A | Entry in Society B | 403 or Empty |
| GET /api/complaints | Admin A | Complaint in Society B | 403 or Empty |
| GET /api/gatepasses | Admin A | GatePass in Society B | 403 or Empty |
| POST /api/domestic-staff | Admin A | Staff for Society B | 400 |

### Automated Test

Create `tests/society-isolation.test.js`:

```javascript
const request = require('supertest');
const app = require('../src/app');

describe('Society Isolation', () => {
  let adminAToken, adminBToken;
  let societyAId, societyBId;
  let entryInSocietyB;

  beforeAll(async () => {
    // Create two societies and get admin tokens
    adminAToken = await getAdminToken('society-a');
    adminBToken = await getAdminToken('society-b');

    // Create entry in Society B
    entryInSocietyB = await createEntry(adminBToken, societyBId);
  });

  describe('Entry Isolation', () => {
    test('Admin A should not see entries from Society B', async () => {
      const res = await request(app)
        .get('/api/v1/entries')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const societyBEntries = res.body.data.entries.filter(
        e => e.societyId === societyBId
      );
      expect(societyBEntries.length).toBe(0);
    });

    test('Admin A should not access specific entry from Society B', async () => {
      const res = await request(app)
        .get(`/api/v1/entries/${entryInSocietyB.id}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      // Should either be 403 or 404
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Complaint Isolation', () => {
    test('Admin A should not see complaints from Society B', async () => {
      const res = await request(app)
        .get('/api/v1/complaints')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const societyBComplaints = res.body.data.filter(
        c => c.societyId === societyBId
      );
      expect(societyBComplaints.length).toBe(0);
    });
  });

  describe('GatePass Isolation', () => {
    test('Admin A cannot create gatepass for Society B flat', async () => {
      const flatInSocietyB = await getFlat(societyBId);

      const res = await request(app)
        .post('/api/v1/gatepasses')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          flatId: flatInSocietyB.id,
          type: 'VISITOR',
          purpose: 'Test'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Staff Isolation', () => {
    test('Admin A should not see staff from Society B', async () => {
      const res = await request(app)
        .get('/api/v1/staff/domestic')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const societyBStaff = res.body.data.staff.filter(
        s => s.societyId === societyBId
      );
      expect(societyBStaff.length).toBe(0);
    });
  });
});
```

Run test:

```bash
npm test tests/society-isolation.test.js
```

---

## 🕐 TEST 5: Midnight-Spanning Time Validation

### Objective
Verify that auto-approve rules work correctly for time ranges spanning midnight.

### Test Cases

```javascript
describe('Midnight-Spanning Time Validation', () => {
  test('Rule 22:00-02:00 should work at 23:00', async () => {
    // Create rule: 22:00 to 02:00
    const rule = await createAutoApproveRule({
      timeFrom: '22:00',
      timeUntil: '02:00',
      companies: ['SWIGGY']
    });

    // Mock current time to 23:00
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T23:00:00'));

    // Create entry - should auto-approve
    const entry = await createEntry({
      type: 'DELIVERY',
      companyName: 'SWIGGY'
    });

    expect(entry.status).toBe('APPROVED');

    jest.useRealTimers();
  });

  test('Rule 22:00-02:00 should work at 01:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-16T01:00:00'));

    const entry = await createEntry({
      type: 'DELIVERY',
      companyName: 'SWIGGY'
    });

    expect(entry.status).toBe('APPROVED');

    jest.useRealTimers();
  });

  test('Rule 22:00-02:00 should NOT work at 03:00', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-16T03:00:00'));

    const entry = await createEntry({
      type: 'DELIVERY',
      companyName: 'SWIGGY'
    });

    expect(entry.status).toBe('PENDING');

    jest.useRealTimers();
  });
});
```

---

## 👨‍👩‍👧‍👦 TEST 6: Family Member Counting

### Objective
Verify that max 6 family members are enforced, including invited (inactive) members.

### Test Script

```javascript
describe('Family Member Limit', () => {
  let primaryResidentToken, flatId;

  beforeAll(async () => {
    // Create primary resident
    primaryResidentToken = await createAndApproveResident();
    flatId = getResidentFlatId(primaryResidentToken);
  });

  test('Should allow inviting up to 5 family members (total 6)', async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/family/invite')
        .set('Authorization', `Bearer ${primaryResidentToken}`)
        .send({
          phone: `+9198765432${10 + i}`,
          name: `Family Member ${i}`,
          familyRole: 'CHILD'
        });

      expect(res.status).toBe(201);
    }
  });

  test('Should prevent inviting 7th member', async () => {
    const res = await request(app)
      .post('/api/family/invite')
      .set('Authorization', `Bearer ${primaryResidentToken}`)
      .send({
        phone: '+919876543220',
        name: 'Extra Member',
        familyRole: 'CHILD'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Maximum 6 family members');
  });

  test('Should count invited but not yet verified members', async () => {
    // Even if members haven't verified OTP, they should count
    const members = await getFamilyMembers(flatId);

    // 1 primary + 5 invited = 6 total
    expect(members.length).toBe(6);

    const inactiveCount = members.filter(m => !m.isActive).length;
    expect(inactiveCount).toBe(5); // Invited but not verified
  });
});
```

---

## 🏠 TEST 7: Flat Owner Validation

### Objective
Verify that only ONE owner can be approved per flat.

### Test Script

```javascript
describe('Flat Owner Validation', () => {
  let adminToken, flatId;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    flatId = await getTestFlat();
  });

  test('Should approve first owner successfully', async () => {
    // Create onboarding request as OWNER
    const request1 = await createOnboardingRequest({
      userId: 'user-1',
      flatId,
      residentType: 'OWNER'
    });

    const res = await request(app)
      .patch(`/api/onboarding/requests/${request1.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('Should reject second owner for same flat', async () => {
    // Create another onboarding request as OWNER
    const request2 = await createOnboardingRequest({
      userId: 'user-2',
      flatId,
      residentType: 'OWNER'
    });

    const res = await request(app)
      .patch(`/api/onboarding/requests/${request2.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409); // Conflict
    expect(res.body.message).toContain('already has an owner');
  });

  test('Should allow tenant after owner is set', async () => {
    const request3 = await createOnboardingRequest({
      userId: 'user-3',
      flatId,
      residentType: 'TENANT'
    });

    const res = await request(app)
      .patch(`/api/onboarding/requests/${request3.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
```

---

## 🚀 TEST 8: End-to-End Critical Workflows

### Workflow 1: Visitor Entry with Pre-Approval

```bash
# 1. Resident creates pre-approval (max 3 uses)
POST /api/preapprovals
Authorization: Bearer <RESIDENT_TOKEN>
{
  "visitorName": "John Doe",
  "visitorPhone": "+919876543210",
  "validFrom": "2024-01-15T00:00:00Z",
  "validUntil": "2024-01-20T23:59:59Z",
  "maxUses": 3
}

# Save QR token from response

# 2. Guard scans QR (1st use)
POST /api/preapprovals/scan
Authorization: Bearer <GUARD_TOKEN>
{
  "qrToken": "<qr-token>",
  "flatId": "<flat-id>",
  "societyId": "<society-id>"
}
# Expected: 200 OK, usedCount: 1, remainingUses: 2

# 3. Guard scans QR (2nd use)
# Expected: 200 OK, usedCount: 2, remainingUses: 1

# 4. Guard scans QR (3rd use)
# Expected: 200 OK, usedCount: 3, remainingUses: 0, status: USED

# 5. Guard scans QR (4th use - should FAIL)
# Expected: 400 Bad Request, "Pre-approval has reached maximum uses"
```

### Workflow 2: Staff Check-In with Notification

```bash
# 1. Create domestic staff
POST /api/v1/staff/domestic
Authorization: Bearer <ADMIN_TOKEN>
{
  "name": "Sunita Devi",
  "staffType": "MAID",
  "phone": "+919999999999"
}

# Save QR token

# 2. Guard scans QR for check-in
POST /api/v1/staff/domestic/qr-scan
Authorization: Bearer <GUARD_TOKEN>
{
  "qrToken": "<staff-qr>",
  "flatId": "<flat-id>",
  "societyId": "<society-id>"
}

# 3. Verify notification sent to flat residents
# - Check Socket.IO event: 'notification'
# - Type: 'STAFF_CHECKIN'
# - Check database: Notification record created

# 4. Guard scans QR for check-out
POST /api/v1/staff/domestic/qr-scan
# (same payload)

# 5. Verify check-out notification
# - Type: 'STAFF_CHECKOUT'
# - Message includes duration
```

---

## 📊 PERFORMANCE BENCHMARKS

### Expected Performance Metrics

| Operation | Target Response Time | Concurrent Users | Success Rate |
|-----------|---------------------|------------------|--------------|
| Entry Creation | < 200ms | 50 | 100% |
| QR Scan (Pre-Approval) | < 150ms | 20 | 100% (with correct rejections) |
| QR Scan (GatePass) | < 150ms | 20 | 100% (only 1 succeeds) |
| Entry Approval | < 300ms | 30 | 100% |
| Socket.IO Notification | < 100ms | 100 | 100% |
| List Entries | < 500ms | 50 | 100% |

### Load Test Script (All Endpoints)

Create `tests/load-test.yml`:

```yaml
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"

scenarios:
  - name: "Entry Creation Flow"
    weight: 30
    flow:
      - post:
          url: "/api/v1/entries"
          headers:
            Authorization: "Bearer {{ guardToken }}"
          json:
            type: "VISITOR"
            flatId: "{{ flatId }}"
            visitorName: "Load Test Visitor"

  - name: "QR Scan Flow"
    weight: 40
    flow:
      - post:
          url: "/api/preapprovals/scan"
          headers:
            Authorization: "Bearer {{ guardToken }}"
          json:
            qrToken: "{{ qrToken }}"
            flatId: "{{ flatId }}"
            societyId: "{{ societyId }}"

  - name: "List Operations"
    weight: 30
    flow:
      - get:
          url: "/api/v1/entries"
          headers:
            Authorization: "Bearer {{ residentToken }}"
```

Run:

```bash
artillery run tests/load-test.yml --output report.json
artillery report report.json
```

---

## ✅ TESTING CHECKLIST

### Before Deployment

- [ ] All unit tests pass (`npm test`)
- [ ] Entry approval authorization works
- [ ] PreApproval QR scan race condition fixed (concurrent test)
- [ ] GatePass scan race condition fixed (concurrent test)
- [ ] Society isolation works (cross-society test)
- [ ] Midnight time validation works
- [ ] Family member limit enforced
- [ ] Flat owner validation works
- [ ] Load test passed (20+ concurrent users)
- [ ] Socket.IO notifications working
- [ ] All critical workflows tested end-to-end

### After Deployment (Staging)

- [ ] Smoke test all endpoints
- [ ] Test with real mobile apps
- [ ] Monitor error logs (first 24 hours)
- [ ] Check database performance
- [ ] Verify Socket.IO connections stable
- [ ] Test file uploads to S3
- [ ] Verify cron jobs running

---

## 🐛 DEBUGGING TIPS

### If Race Condition Tests Fail

```bash
# Check database state after concurrent requests
psql -d society_gate_test -c "SELECT id, usedCount, maxUses FROM \"PreApproval\" WHERE id = 'test-id';"

# Should show usedCount = maxUses, not > maxUses

# Check logs for errors
tail -f logs/app.log | grep -i "race\|concurrent\|conflict"
```

### If Society Isolation Fails

```bash
# Check middleware order in routes
# ensureSameSociety MUST come after authenticate

# Verify user.societyId is set
console.log('User societyId:', req.user?.societyId);

# Check query filters
console.log('Where clause:', where);
// Should include: societyId: req.user.societyId
```

### If Notifications Don't Send

```bash
# Check Socket.IO connection
curl http://localhost:4000/socket.io/?EIO=4&transport=polling

# Check notification service
# Add console.log in notificationService.sendToFlat()
console.log('Sending to flat:', flatId);
console.log('Residents:', residents.length);
```

---

## 📝 TEST REPORT TEMPLATE

After running all tests, document results:

```markdown
# Test Execution Report

**Date:** YYYY-MM-DD
**Tester:** Your Name
**Environment:** Staging/Production

## Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Pass Rate: Y/X%

## Critical Fixes Verification

### 1. Entry Approval Authorization
- Status: ✅ PASS / ❌ FAIL
- Notes: ...

### 2. PreApproval QR Race Condition
- Status: ✅ PASS / ❌ FAIL
- Concurrent requests: 50
- Max uses: 3
- Successful scans: 3
- Failed scans: 47
- Notes: ...

### 3. GatePass Scan Race Condition
- Status: ✅ PASS / ❌ FAIL
- Notes: ...

... (continue for all tests)

## Performance Results
- Average response time: Xms
- 95th percentile: Yms
- Error rate: Z%

## Issues Found
1. ...
2. ...

## Recommendations
1. ...
2. ...
```

---

## 🎯 QUICK START: Minimal Testing

If you have limited time, run these **essential tests** only:

```bash
# 1. PreApproval race condition (5 mins)
./tests/scripts/test-preapproval-race.sh

# 2. GatePass race condition (5 mins)
./tests/scripts/test-gatepass-race.sh

# 3. Society isolation (5 mins)
npm test tests/society-isolation.test.js

# 4. End-to-end smoke test (10 mins)
./tests/scripts/smoke-test.sh
```

**Total: 25 minutes** for critical validation before deployment.

---

## 📚 ADDITIONAL RESOURCES

- [Artillery Documentation](https://www.artillery.io/docs)
- [k6 Load Testing](https://k6.io/docs/)
- [Jest Testing Framework](https://jestjs.io/)
- [Supertest API Testing](https://github.com/visionmedia/supertest)

---

**Last Updated:** January 2026
**Status:** Ready for Testing
**Priority:** HIGH - Test before production deployment
