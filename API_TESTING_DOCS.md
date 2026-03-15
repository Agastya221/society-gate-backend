# API Testing Documentation

This document serves as the authoritative guide for testing the S-Gate API endpoints. It is structured to help frontend developers and QAs easily run `curl` commands to interact with the system.

**Base URL:** `http://localhost:4000/api/v1`

---

## 1. Health Check

Ensure the API is running before attempting any further requests.

```bash
curl -X GET http://localhost:4000/api/v1/health \
  -H "Content-Type: application/json"
```

---

## 2. Authentication

The backend uses **MSG91 OTP Widget** for all authentication.
Frontend embeds MSG91 Widget → Widget handles phone + OTP UI → On success Widget gives a `widgetToken` JWT → Frontend sends `widgetToken` to backend → Backend verifies with MSG91 → Issues our own accessToken + refreshToken.

> **CRITICAL**: No password-based endpoints exist. Users log in strictly via MSG91 `widgetToken`.

### Bootstrap SUPER_ADMIN (One-time only)

Used to seed the initial SUPER_ADMIN account. Permanently disabled after successful execution.

```bash
curl -X POST http://localhost:4000/api/v1/auth/bootstrap-superadmin \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "name": "Platform Admin",
    "email": "admin@platform.com",
    "bootstrapSecret": "your-BOOTSTRAP_SECRET-env-value"
  }'
```

**Response 201:**
```json
{
  "success": true,
  "message": "SUPER_ADMIN created successfully. This endpoint is now permanently disabled.",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Platform Admin",
      "phone": "+919876543210",
      "role": "SUPER_ADMIN",
      "isActive": true
    }
  }
}
```

### Resident App — OTP Verify (Login/Register)

```bash
curl -X POST http://localhost:4000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "widgetToken": "eyJ...",
    "name": "John Doe",
    "email": "john@example.com"
  }'
```
*Note: `name` is required for new users, `email` is optional.*

**Response 200 (New User):**
```json
{
  "success": true,
  "message": "Welcome! Please complete your profile setup.",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "John Doe",
      "phone": "9876543210",
      "role": "RESIDENT",
      "isActive": false,
      "flatId": null,
      "societyId": null
    },
    "requiresOnboarding": true,
    "onboardingStatus": "DRAFT",
    "appType": "RESIDENT_APP"
  }
}
```

**Response 200 (Existing User):**
```json
{
  "success": true,
  "message": "Welcome back, John Doe!",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "John Doe",
      "phone": "9876543210",
      "role": "RESIDENT",
      "isActive": true,
      "flatId": "650e8400-e29b-41d4-a716-446655440002",
      "societyId": "750e8400-e29b-41d4-a716-446655440003"
    },
    "requiresOnboarding": false,
    "onboardingStatus": "COMPLETED",
    "appType": "RESIDENT_APP"
  }
}
```

### Admin App — OTP Verify

```bash
curl -X POST http://localhost:4000/api/v1/auth/admin-app/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "widgetToken": "eyJ..."
  }'
```

**Response 200:**
```json
{
  "success": true,
  "message": "Welcome back, Jane Admin!",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "Jane Admin",
      "role": "ADMIN",
      "societyId": "750e8400-e29b-41d4-a716-446655440003"
    },
    "redirectTo": "ADMIN_PANEL",
    "appType": "RESIDENT_APP"
  }
}
```

### Guard App — OTP Verify

```bash
curl -X POST http://localhost:4000/api/v1/auth/guard-app/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "widgetToken": "eyJ..."
  }'
```

**Response 200:**
```json
{
  "success": true,
  "message": "Welcome back, Guard Name!",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "Guard Name",
      "role": "GUARD",
      "societyId": "750e8400-e29b-41d4-a716-446655440003"
    },
    "appType": "GUARD_APP"
  }
}
```

### Refresh Token

```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJ..."
  }'
```

### Logout

```bash
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "refreshToken": "eyJ..."
  }'
```

### Get Profile (Resident App)

```bash
curl -X GET http://localhost:4000/api/v1/auth/resident-app/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Update Profile (Resident App)

```bash
curl -X PATCH http://localhost:4000/api/v1/auth/resident-app/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "name": "Updated Name",
    "email": "new@example.com",
    "photoUrl": "https://s3.../photo.jpg"
  }'
```

### Create Guard (ADMIN Only)

```bash
curl -X POST http://localhost:4000/api/v1/auth/resident-app/create-guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "Guard Name",
    "phone": "9876543211",
    "photoUrl": "https://s3.../photo.jpg"
  }'
```
*Note: Guards log in via MSG91 widget. No password is provided.*

### Get All Guards (ADMIN Only)

```bash
curl -X GET http://localhost:4000/api/v1/auth/resident-app/guards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

### Toggle User Status (ADMIN Only)

```bash
curl -X PATCH http://localhost:4000/api/v1/auth/resident-app/users/550e8400-e29b-41d4-a716-446655440005/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "isActive": false
  }'
```

---

## 3. Gate Management

### Entry Requests

**Create Entry Request (Guard)**
```bash
curl -X POST http://localhost:4000/api/v1/gate/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>" \
  -d '{
    "type": "VISITOR",
    "flatId": "650e8400-e29b-41d4-a716-446655440002",
    "visitorName": "Delivery Person",
    "visitorPhone": "9876543212",
    "providerTag": "AMAZON",
    "photoKey": "s3-key-from-upload"
  }'
```

**Get Entry Requests (Resident/Admin)**
```bash
curl -X GET "http://localhost:4000/api/v1/gate/requests?status=PENDING&flatId=650e8400-e29b-41d4-a716-446655440002&page=1&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Get Entry Request Photo**
```bash
curl -X GET http://localhost:4000/api/v1/gate/requests/550e8400-e29b-41d4-a716-446655440006/photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Approve Entry Request (Resident/Admin)**
```bash
curl -X PATCH http://localhost:4000/api/v1/gate/requests/550e8400-e29b-41d4-a716-446655440006/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Reject Entry Request (Resident/Admin)**
```bash
curl -X PATCH http://localhost:4000/api/v1/gate/requests/550e8400-e29b-41d4-a716-446655440006/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "reason": "Not expecting any visitor"
  }'
```

### Pre-Approvals

**Create Pre-Approval (Resident)**
```bash
curl -X POST http://localhost:4000/api/v1/gate/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "visitorName": "Guest Name",
    "visitorPhone": "9876543213",
    "flatId": "650e8400-e29b-41d4-a716-446655440002",
    "validFrom": "2024-01-15T09:00:00Z",
    "validUntil": "2024-01-15T18:00:00Z",
    "visitorType": "GUEST"
  }'
```

**Get My Pre-Approvals**
```bash
curl -X GET "http://localhost:4000/api/v1/gate/?status=ACTIVE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Get Pre-Approval QR Code**
```bash
curl -X GET http://localhost:4000/api/v1/gate/550e8400-e29b-41d4-a716-446655440007/qr \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Cancel Pre-Approval**
```bash
curl -X DELETE http://localhost:4000/api/v1/gate/550e8400-e29b-41d4-a716-446655440007 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Gate Passes

**Create Gate Pass**
```bash
curl -X POST http://localhost:4000/api/v1/gate/passes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "type": "MATERIAL",
    "flatId": "650e8400-e29b-41d4-a716-446655440002",
    "subject": "Furniture Delivery",
    "validFrom": "2024-01-15T09:00:00Z",
    "validUntil": "2024-01-15T18:00:00Z",
    "details": "Sofa and dining table from Urban Ladder"
  }'
```

**Get Gate Passes**
```bash
curl -X GET "http://localhost:4000/api/v1/gate/passes?status=PENDING&type=MATERIAL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

**Get Gate Pass by ID**
```bash
curl -X GET http://localhost:4000/api/v1/gate/passes/550e8400-e29b-41d4-a716-446655440008 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

**Approve Gate Pass (Admin)**
```bash
curl -X PATCH http://localhost:4000/api/v1/gate/passes/550e8400-e29b-41d4-a716-446655440008/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

**Reject Gate Pass (Admin)**
```bash
curl -X PATCH http://localhost:4000/api/v1/gate/passes/550e8400-e29b-41d4-a716-446655440008/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "reason": "Invalid documentation"
  }'
```

### Entries

**Get All Entries**
```bash
curl -X GET "http://localhost:4000/api/v1/gate/entries?flatId=650e8400-e29b-41d4-a716-446655440002&status=CHECKED_IN&type=DELIVERY&page=1&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Get Pending Approvals**
```bash
curl -X GET http://localhost:4000/api/v1/gate/entries/pending \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

---

## 4. Guard App Routes

**Get Today's Dashboard**
```bash
curl -X GET http://localhost:4000/api/v1/guard/today \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>"
```

**Get Pending Entry Count**
```bash
curl -X GET http://localhost:4000/api/v1/guard/pending-count \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>"
```

**Get Entries**
```bash
curl -X GET http://localhost:4000/api/v1/guard/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>"
```

**Checkout Entry**
```bash
curl -X PATCH http://localhost:4000/api/v1/guard/entries/550e8400-e29b-41d4-a716-446655440009/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>"
```

**Scan Pre-Approval QR**
```bash
curl -X POST http://localhost:4000/api/v1/gate/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>" \
  -d '{
    "qrToken": "unique-qr-token"
  }'
```

**Scan Gate Pass**
```bash
curl -X POST http://localhost:4000/api/v1/gate/passes/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>" \
  -d '{
    "qrToken": "gatepass-qr-token"
  }'
```

---

## 5. Community

### Notices

**List Notices**
```bash
curl -X GET http://localhost:4000/api/v1/community/notices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Amenities & Bookings

**List Amenities**
```bash
curl -X GET http://localhost:4000/api/v1/community/amenities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Complaints

**Create Complaint**
```bash
curl -X POST http://localhost:4000/api/v1/community/complaints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "category": "PLUMBING",
    "subject": "Bathroom leak",
    "description": "Water leaking from bathroom pipe",
    "priority": "HIGH"
  }'
```

### Emergencies

**Create Emergency Alert**
```bash
curl -X POST http://localhost:4000/api/v1/community/emergencies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "type": "MEDICAL",
    "location": "A-101",
    "description": "Heart attack, need ambulance."
  }'
```

---

## 6. Resident Routes

### Onboarding

**Submit Onboarding Details**
```bash
curl -X POST http://localhost:4000/api/v1/resident/onboarding \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <onboarding_token>" \
  -d '{
    "flatId": "650e8400-e29b-41d4-a716-446655440002"
  }'
```

### Notifications

**Get Notifications**
```bash
curl -X GET http://localhost:4000/api/v1/resident/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Family

**Add Family Member**
```bash
curl -X POST http://localhost:4000/api/v1/resident/family \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "name": "Sita Doe",
    "phone": "9876543219",
    "role": "SPOUSE"
  }'
```

---

## 7. Staff Management

### Domestic Staff

**List Domestic Staff**
```bash
curl -X GET http://localhost:4000/api/v1/staff/domestic \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

### Vendors

**List Vendors**
```bash
curl -X GET http://localhost:4000/api/v1/staff/vendors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

---

## 8. Deliveries

**Create Expected Delivery**
```bash
curl -X POST http://localhost:4000/api/v1/gate/deliveries/expected \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "flatId": "650e8400-e29b-41d4-a716-446655440002",
    "company": "Amazon",
    "expectedDate": "2024-01-15",
    "trackingId": "AMZN123456"
  }'
```

**Get Expected Deliveries**
```bash
curl -X GET http://localhost:4000/api/v1/gate/deliveries/expected \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Create Auto-Approve Rule**
```bash
curl -X POST http://localhost:4000/api/v1/gate/deliveries/auto-approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "company": "Swiggy",
    "autoApprove": true
  }'
```

**Get Popular Delivery Companies**
```bash
curl -X GET http://localhost:4000/api/v1/gate/deliveries/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

---

## 9. Upload

**Get Pre-signed Upload URL**
```bash
curl -X POST http://localhost:4000/api/v1/upload/presigned-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "context": "entry-photo",
    "fileName": "visitor.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 1024000,
    "documentType": "OTHER"
  }'
```

**Confirm Upload**
```bash
curl -X POST http://localhost:4000/api/v1/upload/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "s3Key": "uploads/uuid/visitor.jpg",
    "fileName": "visitor.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 1024000,
    "documentType": "OTHER"
  }'
```

**Get Document View URL**
```bash
curl -X GET http://localhost:4000/api/v1/upload/550e8400-e29b-41d4-a716-446655440010/view-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**Delete Document**
```bash
curl -X DELETE http://localhost:4000/api/v1/upload/550e8400-e29b-41d4-a716-446655440010 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

---

## 10. Admin Routes

**Get Society Statistics**
```bash
curl -X GET http://localhost:4000/api/v1/admin/societies/750e8400-e29b-41d4-a716-446655440003/stats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

**Get Dashboard Stats**
```bash
curl -X GET http://localhost:4000/api/v1/admin/reports/dashboard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>"
```

---

## 11. Society Registration

**Submit Registration Request (Any authenticated user)**
```bash
curl -X POST http://localhost:4000/api/v1/society-registration/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "societyName": "Green Valley Apartments",
    "address": "123 Main Road",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "contactName": "Rahul Sharma",
    "contactPhone": "+919876543210",
    "contactEmail": "rahul@greenvalley.com",
    "totalFlats": 120,
    "monthlyFee": 2500
  }'
```

**Get My Request Status**
```bash
curl -X GET http://localhost:4000/api/v1/society-registration/my-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>"
```

**List All Requests (SUPER_ADMIN only)**
```bash
curl -X GET "http://localhost:4000/api/v1/society-registration/requests?status=PENDING&page=1&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>"
```

**Get Single Request (SUPER_ADMIN only)**
```bash
curl -X GET http://localhost:4000/api/v1/society-registration/requests/550e8400-e29b-41d4-a716-446655440011 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>"
```

**Approve Request (SUPER_ADMIN only)**
```bash
curl -X POST http://localhost:4000/api/v1/society-registration/requests/550e8400-e29b-41d4-a716-446655440011/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>"
```

**Reject Request (SUPER_ADMIN only)**
```bash
curl -X POST http://localhost:4000/api/v1/society-registration/requests/550e8400-e29b-41d4-a716-446655440011/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <super_admin_token>" \
  -d '{
    "rejectionReason": "Incomplete address details provided."
  }'
```

---

## 12. Enums Reference

### User Roles
| Value | Description |
|-------|-------------|
| `SUPER_ADMIN` | Platform super administrator |
| `ADMIN` | Society admin |
| `GUARD` | Security guard |
| `RESIDENT` | Flat owner/tenant |

### Entry Types
| Value | Description |
|-------|-------------|
| `VISITOR` | Guest/visitor |
| `DELIVERY` | Package delivery |
| `DOMESTIC_STAFF` | Maid/cook/etc. |
| `CAB` | Taxi/cab driver |
| `VENDOR` | Service provider |

### Entry Status
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting approval |
| `APPROVED` | Entry approved |
| `REJECTED` | Entry rejected |
| `CHECKED_IN` | Visitor inside |
| `CHECKED_OUT` | Visitor left |

### Entry Request Status
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting resident response |
| `APPROVED` | Resident approved |
| `REJECTED` | Resident rejected |
| `EXPIRED` | Request expired (15 min) |

### Pre-Approval Status
| Value | Description |
|-------|-------------|
| `ACTIVE` | Can be used |
| `EXPIRED` | Time expired |

### Document Type
| Value | Description |
|-------|-------------|
| `OWNERSHIP_PROOF` | Property ownership proof |
| `TENANT_AGREEMENT` | Rental agreement |
| `AADHAR_CARD` | Aadhar card |
| `PAN_CARD` | PAN card |
| `PASSPORT` | Passport |
| `DRIVING_LICENSE` | Driving license |
| `VOTER_ID` | Voter ID |
| `OTHER` | Other document |

### Notification Type
| Value | Description |
|-------|-------------|
| `ONBOARDING_STATUS` | Onboarding updates |
| `ENTRY_REQUEST` | Entry request notification |
| `DELIVERY_REQUEST` | Delivery notification |
| `EMERGENCY_ALERT` | Emergency alert |
| `STAFF_CHECKIN` | Staff check-in |
| `STAFF_CHECKOUT` | Staff check-out |
| `SYSTEM` | System notification |

### Payment Status
| Value | Description |
|-------|-------------|
| `PENDING` | Payment pending |
| `PAID` | Paid |
| `OVERDUE` | Payment overdue |

---

## Quick Reference / Troubleshooting

### Role Access Breakdown
- **SUPER_ADMIN**: Full access. Bootstrapped, then manages society approvals.
- **ADMIN**: Manages a specific society (Guards, Users, Gate Passes).
- **RESIDENT**: Can read/write pre-approvals, entries, profile, family, amenities, society registration requests.
- **GUARD**: Can scan QR codes, list today's entries, checkout entries, create entry requests.

### Expected Authentication Errors Table

| Status | Error Context | Message snippet / Description |
|--------|---------------|-------------------------------|
| `400`  | Bad Request   | Missing name for new user. Invalid widget token. |
| `401`  | Unauthorized  | Token missing/invalid/expired. |
| `403`  | Forbidden     | Wrong secret. Inactive account. Wrong app. |
| `404`  | Not Found     | No account found (Admin/Guard login on unlinked number). |
| `409`  | Conflict      | Number taken OR Registration requests already pending. |
| `500`  | Server Error  | Internal error, DB issue, missing env config. |

### Testing Order Guide
1. **Bootstrap Super Admin**: POST `/auth/bootstrap-superadmin`
2. **Resident Registers**: POST `/auth/otp/verify` (`name` required) -> gets status `DRAFT`
3. **Resident Requests Society**: POST `/society-registration/request`
4. **Super Admin Approves Society**: POST `/society-registration/requests/:id/approve`
5. **Resident Admin Manages Platform**: That resident has their role updated to `ADMIN` and handles guards/flats/etc.

*(Note: `TEST_CREDENTIALS_FULL.md` contains seed data specifics. Auth is completely OTP-based using MSG91, so do not attempt password-based tests unless interacting with local test-only mock adapters if built-in elsewhere.)*
