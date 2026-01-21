# 🔐 Test Credentials - Society Gate Backend

All accounts use the same password for easy testing: **`Test@1234`**

---

## 📱 Login Information by Role

### 1. Super Admin

**Super Admin Account** (Full system access)
- **Email**: superadmin@societygate.com
- **Phone**: +919999999999
- **Password**: Test@1234
- **Access**: All societies, all features

**API Endpoints**:
```bash
POST /api/auth/login
{
  "email": "superadmin@societygate.com",
  "password": "Test@1234"
}
```

---

### 2. Society Admins

#### Skyline Residency Admin
- **Name**: Rajesh Kumar
- **Email**: rajesh.admin@skyline.com
- **Phone**: +919876543210
- **Password**: Test@1234
- **Society**: Skyline Residency (Bangalore)
- **Access**: All features for Skyline Residency

**API Endpoints**:
```bash
POST /api/auth/login
{
  "email": "rajesh.admin@skyline.com",
  "password": "Test@1234"
}
```

#### Green Valley Admin
- **Name**: Priya Sharma
- **Email**: priya.admin@greenvalley.com
- **Phone**: +919876543299
- **Password**: Test@1234
- **Society**: Green Valley Apartments (Mumbai)
- **Access**: All features for Green Valley

**API Endpoints**:
```bash
POST /api/auth/login
{
  "email": "priya.admin@greenvalley.com",
  "password": "Test@1234"
}
```

---

### 3. Guards

#### Skyline Residency Guards

**Guard 1 - Ramesh Singh**
- **Email**: ramesh.guard@skyline.com
- **Phone**: +919123456780
- **Password**: Test@1234
- **Society**: Skyline Residency

**Guard 2 - Suresh Yadav**
- **Email**: suresh.guard@skyline.com
- **Phone**: +919123456781
- **Password**: Test@1234
- **Society**: Skyline Residency

**API Endpoints**:
```bash
POST /api/auth/guard/login
{
  "phone": "+919123456780",
  "password": "Test@1234"
}
```

#### Green Valley Guard

**Guard 3 - Mohan Das**
- **Email**: mohan.guard@greenvalley.com
- **Phone**: +919123456790
- **Password**: Test@1234
- **Society**: Green Valley Apartments

**API Endpoints**:
```bash
POST /api/auth/guard/login
{
  "phone": "+919123456790",
  "password": "Test@1234"
}
```

---

### 4. Residents

#### Skyline Residency Residents

**Resident 1 - Amit Verma** (Owner, Primary)
- **Email**: amit.verma@gmail.com
- **Phone**: +919111111111
- **Password**: Test@1234
- **Flat**: A101 (Block A, Floor 1)
- **Status**: Owner, Primary Resident

**Resident 2 - Sneha Reddy** (Owner, Primary)
- **Email**: sneha.reddy@gmail.com
- **Phone**: +919111111112
- **Password**: Test@1234
- **Flat**: A201 (Block A, Floor 2)
- **Status**: Owner, Primary Resident

**Resident 3 - Vikram Singh** (Tenant)
- **Email**: vikram.singh@gmail.com
- **Phone**: +919111111113
- **Password**: Test@1234
- **Flat**: A301 (Block A, Floor 3)
- **Status**: Tenant

**Resident 4 - Anita Desai** (Owner, Primary)
- **Email**: anita.desai@gmail.com
- **Phone**: +919111111114
- **Password**: Test@1234
- **Flat**: A401 (Block A, Floor 4)
- **Status**: Owner, Primary Resident

**Resident 5 - Rahul Kapoor** (Owner, Primary)
- **Email**: rahul.kapoor@gmail.com
- **Phone**: +919111111115
- **Password**: Test@1234
- **Flat**: A501 (Block A, Floor 5)
- **Status**: Owner, Primary Resident

**API Endpoints** (ResidentApp):
```bash
# Step 1: Request OTP
POST /api/auth/resident-app/request-otp
{
  "phone": "+919111111111"
}

# Step 2: Verify OTP (for testing, check Redis or use dummy OTP if configured)
POST /api/auth/resident-app/verify-otp
{
  "phone": "+919111111111",
  "otp": "123456"
}

# Alternative: Email/Password Login
POST /api/auth/login
{
  "email": "amit.verma@gmail.com",
  "password": "Test@1234"
}
```

#### Green Valley Residents

**Resident 6 - Kiran Patel** (Owner, Primary)
- **Email**: kiran.patel@gmail.com
- **Phone**: +919222222221
- **Password**: Test@1234
- **Flat**: C101 (Tower C, Floor 1)
- **Status**: Owner, Primary Resident

**Resident 7 - Maya Iyer** (Owner, Primary)
- **Email**: maya.iyer@gmail.com
- **Phone**: +919222222222
- **Password**: Test@1234
- **Flat**: C201 (Tower C, Floor 2)
- **Status**: Owner, Primary Resident

---

## 🧪 Test Data for Race Condition Testing

### Pre-Approval QR Codes

**PreApproval 1 - Regular Use**
- **QR Token**: `PRE_SKYLINE_001`
- **Visitor**: Rohit Sharma (+919333333331)
- **Max Uses**: 3
- **Status**: Active
- **Flat**: A101 (Amit Verma)

**PreApproval 2 - Race Condition Test**
- **QR Token**: `PRE_RACE_TEST_001`
- **Visitor**: Test Visitor (+919333333332)
- **Max Uses**: 3
- **Used Count**: 0
- **Status**: Active
- **Flat**: A101 (Amit Verma)
- **Purpose**: For testing concurrent QR scans

### Gate Pass QR Codes

**GatePass 1 - Regular**
- **QR Token**: `GATE_SKYLINE_001`
- **Type**: MATERIAL
- **Title**: Furniture Moving
- **Status**: Approved, Not Used
- **Flat**: A101

**GatePass 2 - Race Condition Test**
- **QR Token**: `GATE_RACE_TEST_001`
- **Type**: VEHICLE
- **Title**: Vehicle Entry
- **Status**: Approved, Not Used
- **Flat**: A101
- **Purpose**: For testing concurrent QR scans

---

## 🔧 Testing Race Conditions

### Update Race Condition Test Config

Edit `tests/race-condition-test.js`:

```javascript
const CONFIG = {
  apiBase: 'http://localhost:4000',
  guardToken: '<GET_FROM_GUARD_LOGIN>',  // Login as guard first

  preApproval: {
    qrToken: 'PRE_RACE_TEST_001',
    flatId: '<AMIT_VERMA_FLAT_ID>',      // Query from DB or API
    societyId: '<SKYLINE_SOCIETY_ID>',    // Query from DB or API
    expectedMaxUses: 3,
  },

  gatePass: {
    qrCode: 'GATE_RACE_TEST_001',
    guardId: '<RAMESH_GUARD_ID>',         // Query from DB or API
  },
};
```

### Run Race Condition Tests

```bash
# 1. Get guard token
curl -X POST http://localhost:4000/api/auth/guard/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919123456780", "password": "Test@1234"}'

# 2. Run test
node tests/race-condition-test.js
```

---

## 🏢 Multi-Tenancy Testing

### Test Society Isolation

Edit `tests/society-isolation-test.js`:

```javascript
const CONFIG = {
  apiBase: 'http://localhost:4000',

  // Society A (Skyline Residency)
  societyA: {
    adminToken: '<RAJESH_ADMIN_TOKEN>',
    residentToken: '<AMIT_RESIDENT_TOKEN>',
    societyId: '<SKYLINE_SOCIETY_ID>',
  },

  // Society B (Green Valley)
  societyB: {
    adminToken: '<PRIYA_ADMIN_TOKEN>',
    residentToken: '<KIRAN_RESIDENT_TOKEN>',
    societyId: '<GREEN_VALLEY_SOCIETY_ID>',
    // Sample data IDs from Society B
    entryId: '<ENTRY_ID_FROM_GREEN_VALLEY>',
    complaintId: '<COMPLAINT_ID_FROM_GREEN_VALLEY>',
    staffId: '<STAFF_ID_FROM_GREEN_VALLEY>',
  },
};
```

### Run Society Isolation Tests

```bash
node tests/society-isolation-test.js
```

Expected: Society A admin should NOT be able to access Society B data.

---

## 📊 Quick Test Commands

### Get Guard Token
```bash
curl -X POST http://localhost:4000/api/auth/guard/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919123456780", "password": "Test@1234"}'
```

### Get Admin Token
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "rajesh.admin@skyline.com", "password": "Test@1234"}'
```

### Get Resident Token (Email/Password)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "amit.verma@gmail.com", "password": "Test@1234"}'
```

### List All Entries (Admin)
```bash
curl -X GET http://localhost:4000/api/v1/entries \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Scan PreApproval QR (Guard)
```bash
curl -X POST http://localhost:4000/api/preapprovals/scan \
  -H "Authorization: Bearer <GUARD_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "PRE_RACE_TEST_001",
    "flatId": "<FLAT_ID>",
    "societyId": "<SOCIETY_ID>"
  }'
```

### Scan GatePass QR (Guard)
```bash
curl -X POST http://localhost:4000/api/gatepasses/scan \
  -H "Authorization: Bearer <GUARD_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrCode": "GATE_RACE_TEST_001",
    "guardId": "<GUARD_ID>"
  }'
```

---

## 🗂️ Database Query Helpers

### Get IDs from Database

```sql
-- Get Society IDs
SELECT id, name FROM "Society";

-- Get Flat IDs for Amit Verma
SELECT f.id, f.flatNumber, u.name
FROM "Flat" f
JOIN "User" u ON u.flatId = f.id
WHERE u.email = 'amit.verma@gmail.com';

-- Get Guard IDs
SELECT id, name, phone FROM "User" WHERE role = 'GUARD';

-- Get Entry IDs for Green Valley
SELECT e.id, e.visitorName, s.name as society
FROM "Entry" e
JOIN "Society" s ON e.societyId = s.id
WHERE s.name = 'Green Valley Apartments';

-- Get Complaint IDs for Green Valley
SELECT c.id, c.title, s.name as society
FROM "Complaint" c
JOIN "Society" s ON c.societyId = s.id
WHERE s.name = 'Green Valley Apartments';

-- Get Domestic Staff IDs for Green Valley
SELECT ds.id, ds.name, ds.staffType, s.name as society
FROM "DomesticStaff" ds
JOIN "Society" s ON ds.societyId = s.id
WHERE s.name = 'Green Valley Apartments';
```

---

## 🎯 Testing Checklist

### Security Tests
- [ ] **Race Condition**: Run `node tests/race-condition-test.js` - Verify only 3 pre-approval scans succeed, only 1 gate pass scan succeeds
- [ ] **Society Isolation**: Run `node tests/society-isolation-test.js` - Verify Society A cannot access Society B data
- [ ] **Entry Approval**: Verify only flat residents can approve entries for their flat
- [ ] **Family Member Limit**: Try adding 7th family member, should fail
- [ ] **Flat Owner Validation**: Try approving 2 owners for same flat, should fail

### Functional Tests
- [ ] Guard can create entries
- [ ] Resident can approve/reject entries
- [ ] Admin can manage society data
- [ ] Pre-approvals work within maxUses limit
- [ ] Gate passes can be scanned once
- [ ] Notifications are created for entry requests
- [ ] Amenity bookings work correctly
- [ ] Complaints can be filed and managed
- [ ] Domestic staff can be added and assigned

---

## 📞 Support

If you encounter any issues:
1. Check server logs: `npm run dev`
2. Check database: `npx prisma studio`
3. Verify JWT_SECRET is set in `.env`
4. Ensure database is running and migrations are applied

---

## 🔒 Security Note

**IMPORTANT**: These are TEST credentials only. Never use these in production:
- Change all passwords before deployment
- Rotate JWT_SECRET
- Update AWS credentials
- Use proper OTP provider for resident authentication
- Enable rate limiting
- Set up proper CORS policies

---

**Generated**: 2026-01-22
**Database Seeded**: ✅ Successfully
**Total Test Accounts**: 13 users across 2 societies

