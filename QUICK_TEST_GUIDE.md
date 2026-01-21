# 🚀 Quick Test Guide - 5 Minutes

## Password for ALL accounts: `Test@1234`

---

## 📧 Email Login Credentials

### Super Admin
- **Email**: superadmin@societygate.com
- **Password**: Test@1234

### Skyline Residency (Bangalore)
- **Admin**: rajesh.admin@skyline.com / Test@1234
- **Guard**: ramesh.guard@skyline.com / Test@1234
- **Resident**: amit.verma@gmail.com / Test@1234

### Green Valley (Mumbai)
- **Admin**: priya.admin@greenvalley.com / Test@1234
- **Guard**: mohan.guard@greenvalley.com / Test@1234
- **Resident**: kiran.patel@gmail.com / Test@1234

---

## 📱 Phone Login (Guard App)

### Skyline Guards
- Phone: +919123456780 (Ramesh)
- Phone: +919123456781 (Suresh)
- Password: Test@1234

### Green Valley Guard
- Phone: +919123456790 (Mohan)
- Password: Test@1234

---

## 🧪 Race Condition Test Data

### Pre-Approval QR
- **QR Token**: `PRE_RACE_TEST_001`
- **Max Uses**: 3
- **Purpose**: Test concurrent scans

### Gate Pass QR
- **QR Token**: `GATE_RACE_TEST_001`
- **Single Use**: Should allow only 1 scan
- **Purpose**: Test concurrent scans

---

## ⚡ Quick API Tests

### 1. Login as Guard
```bash
curl -X POST http://localhost:4000/api/auth/guard/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919123456780", "password": "Test@1234"}'
```
**Copy the `token` from response**

### 2. Login as Admin
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "rajesh.admin@skyline.com", "password": "Test@1234"}'
```

### 3. Login as Resident
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "amit.verma@gmail.com", "password": "Test@1234"}'
```

### 4. Test Society Isolation
```bash
# Login as Skyline admin (get token)
# Try to access Green Valley data (should fail)
curl -X GET http://localhost:4000/api/v1/entries \
  -H "Authorization: Bearer <SKYLINE_ADMIN_TOKEN>"

# Should NOT see Green Valley entries
```

---

## 🎯 Testing Workflows

### Test 1: Entry Approval Flow
1. Login as Guard (Ramesh): +919123456780 / Test@1234
2. Create new visitor entry for Flat A101
3. Login as Resident (Amit): amit.verma@gmail.com / Test@1234
4. Approve the entry
5. Verify guard can check in visitor

### Test 2: PreApproval QR Scan
1. Login as Guard: +919123456780 / Test@1234
2. Scan QR: `PRE_RACE_TEST_001`
3. Should succeed (1st scan)
4. Scan again (2nd scan - should succeed)
5. Scan again (3rd scan - should succeed)
6. Scan again (4th scan - should FAIL with "maximum uses")

### Test 3: Gate Pass QR Scan
1. Login as Guard: +919123456780 / Test@1234
2. Scan QR: `GATE_RACE_TEST_001`
3. Should succeed (1st scan)
4. Scan again - should FAIL with "already been used"

### Test 4: Multi-Tenancy Isolation
1. Login as Skyline Admin: rajesh.admin@skyline.com / Test@1234
2. Try to list entries - should only see Skyline entries
3. Login as Green Valley Admin: priya.admin@greenvalley.com / Test@1234
4. Try to list entries - should only see Green Valley entries
5. Verify no cross-society data leakage

---

## 🗂️ Database Access

### Using Prisma Studio
```bash
npx prisma studio
# Opens http://localhost:5555
# Browse all tables and data
```

### Quick Database Queries
```bash
# Connect to PostgreSQL
psql <YOUR_DATABASE_URL>

# View all users
SELECT id, name, email, phone, role FROM "User";

# View all societies
SELECT id, name, city FROM "Society";

# View QR codes for testing
SELECT id, qrToken, status, usedCount, maxUses FROM "PreApproval";
SELECT id, qrToken, status, isUsed FROM "GatePass";
```

---

## 🔧 Common Commands

### Start Backend
```bash
npm run dev
```

### Regenerate Prisma Client
```bash
npx prisma generate
```

### Reset & Reseed Database
```bash
npx prisma migrate reset
npm run seed
```

### View Logs
```bash
# Backend logs show all API requests
# Check for:
# - Authentication events
# - Race condition handling
# - Society isolation enforcement
```

---

## 📊 Expected Test Results

### ✅ PASS Criteria

**Race Conditions**:
- PreApproval QR: Exactly 3 scans succeed, rest fail
- GatePass QR: Exactly 1 scan succeeds, rest fail
- No usedCount exceeds maxUses in database

**Society Isolation**:
- Admins see only their society's data
- Cross-society access returns 403/404
- No data leakage in list endpoints

**Authorization**:
- Only flat residents can approve entries for their flat
- Other residents get 403 Forbidden

---

## 🆘 Troubleshooting

### Issue: "401 Unauthorized"
- Token expired (Guards: 7 days, Residents: 30 days)
- Login again to get fresh token

### Issue: "403 Forbidden"
- Trying to access other society's data (working as expected)
- Using wrong role (e.g., Guard trying admin endpoint)

### Issue: Redis Connection Error
- Optional for testing - race conditions work without Redis
- To fix: `docker run -d -p 6379:6379 redis:alpine`

### Issue: Database Connection Failed
- Check DATABASE_URL in .env
- Verify PostgreSQL is running
- Run migrations: `npx prisma migrate deploy`

---

## 📚 Full Documentation

- **Complete Credentials**: See [TEST_CREDENTIALS_FULL.md](TEST_CREDENTIALS_FULL.md)
- **API Reference**: See [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)
- **Testing Guide**: See [tests/README.md](tests/README.md)
- **Security Audit**: See [FINAL_SECURITY_AUDIT.md](FINAL_SECURITY_AUDIT.md)

---

**Happy Testing! 🎉**
