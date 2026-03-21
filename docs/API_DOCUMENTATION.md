# Society Gate Backend - API Documentation

**Base URL:** `http://localhost:4000/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Gate Management](#2-gate-management)
   - [Entry Requests](#21-entry-requests)
   - [Invite Passes](#22-invite-passes)
   - [Gate Passes](#23-gate-passes)
3. [Guard App](#3-guard-app)
4. [Community](#4-community)
   - [Notices](#41-notices)
   - [Amenities & Bookings](#42-amenities--bookings)
   - [Complaints](#43-complaints)
   - [Emergencies](#44-emergencies)
5. [Resident](#5-resident)
   - [Onboarding](#51-onboarding)
   - [Notifications](#52-notifications)
   - [Family](#53-family)
6. [Staff Management](#6-staff-management)
   - [Domestic Staff](#61-domestic-staff)
   - [Vendors](#62-vendors)
7. [Admin](#7-admin)
   - [Societies](#71-societies)
   - [Reports](#72-reports)
8. [Upload](#8-upload)
9. [Society Registration](#9-society-registration)
10. [Enums Reference](#10-enums-reference)

---

## Authentication Headers

All authenticated endpoints require:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 1. Authentication

The backend uses MSG91 OTP Widget for all authentication.
The widget handles phone entry, OTP delivery, and verification on the
frontend. On success it gives your app a short-lived `widgetToken`.
You send that token to the backend — the backend verifies it with
MSG91 and issues your accessToken + refreshToken.

**Token lifetimes:**
- accessToken: 1 hour
- refreshToken: 30 days (residents) / 7 days (guards)

---

### Bootstrap SUPER_ADMIN (one-time only)
```http
POST /auth/bootstrap-superadmin
```
No authentication required. Permanently disabled after first use.

**Request Body:**
```json
{
  "phone": "+919876543210",
  "name": "Platform Admin",
  "email": "admin@platform.com",
  "bootstrapSecret": "your-BOOTSTRAP_SECRET-env-value"
}
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
      "id": "uuid",
      "name": "Platform Admin",
      "phone": "+919876543210",
      "role": "SUPER_ADMIN",
      "isActive": true
    }
  }
}
```

**Errors:** 403 wrong secret | 403 already done | 409 phone taken | 500 secret not configured

---

### Resident App — Login / Register
```http
POST /auth/otp/verify
```
No authentication required. Creates a new user if phone not seen before.

**Request Body:**
```json
{
  "widgetToken": "token-from-msg91-widget",
  "name": "John Doe",
  "email": "john@example.com"
}
```
Note: `name` and `email` are both optional. Name is collected during onboarding, not at signup.

**Response — New User:**
```json
{
  "success": true,
  "message": "Welcome! Please complete your profile setup.",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "name": "",
      "phone": "9876543210",
      "role": "RESIDENT",
      "isActive": false,
      "flatId": null,
      "societyId": null
    },
    "requiresOnboarding": true,
    "onboardingStatus": "DRAFT",
    "appType": "RESIDENT_APP",
    "redirectTo": "ONBOARDING"
  }
}
```

**Response — Existing Resident:**
```json
{
  "success": true,
  "message": "Welcome back, John Doe!",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "9876543210",
      "role": "RESIDENT",
      "isActive": true,
      "flatId": "uuid",
      "societyId": "uuid"
    },
    "requiresOnboarding": false,
    "onboardingStatus": "COMPLETED",
    "appType": "RESIDENT_APP",
    "redirectTo": "RESIDENT_PANEL"
  }
}
```

**Response — Existing Admin/Super Admin:**
```json
{
  "success": true,
  "message": "Welcome back, Admin Name!",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "name": "Admin Name",
      "phone": "9876543210",
      "role": "ADMIN",
      "isActive": true,
      "flatId": null,
      "societyId": "uuid"
    },
    "requiresOnboarding": false,
    "onboardingStatus": "APPROVED",
    "appType": "RESIDENT_APP",
    "redirectTo": "ADMIN_PANEL"
  }
}
```

**Errors:** 400 invalid widget token

---

### Admin App — Login
```http
POST /auth/admin-app/otp/verify
```
No authentication required. For existing ADMIN, SUPER_ADMIN, RESIDENT accounts only.
Does NOT create new users.

**Request Body:**
```json
{
  "widgetToken": "token-from-msg91-widget"
}
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
      "id": "uuid",
      "name": "Jane Admin",
      "role": "ADMIN",
      "societyId": "uuid"
    },
    "redirectTo": "ADMIN_PANEL",
    "appType": "RESIDENT_APP"
  }
}
```

Note: `redirectTo` is either `ADMIN_PANEL` (for ADMIN/SUPER_ADMIN) or
`RESIDENT_PANEL` (for RESIDENT). Use this to decide which screen to show.

**Errors:** 404 no account found | 403 wrong app | 403 account inactive

---

### Guard App — Login
```http
POST /auth/guard-app/otp/verify
```
No authentication required. For GUARD accounts only.

**Request Body:**
```json
{
  "widgetToken": "token-from-msg91-widget"
}
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
      "id": "uuid",
      "name": "Guard Name",
      "role": "GUARD",
      "societyId": "uuid"
    },
    "appType": "GUARD_APP"
  }
}
```

**Errors:** 404 no guard account | 403 not a guard | 403 account inactive | 403 society inactive

---

### Refresh Token
```http
POST /auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

Note: Token rotation — every refresh returns a NEW refreshToken.
Store the new one, discard the old one.

---

### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

What happens: accessToken blacklisted in Redis, refreshToken cleared
from database. Both tokens are dead immediately.

---

### Get Profile (Resident App)
```http
GET /auth/resident-app/profile
Authorization: Bearer <access_token>
```

---

### Update Profile (Resident App)
```http
PATCH /auth/resident-app/profile
Authorization: Bearer <access_token>
```

**Request Body (all optional):**
```json
{
  "name": "Updated Name",
  "email": "new@example.com",
  "photoUrl": "https://s3.../photo.jpg"
}
```

---

### Register FCM Token (Resident App)
```http
PATCH /auth/resident-app/fcm-token
Authorization: Bearer <access_token>
```

Call this after login and whenever the device FCM token changes.
Required for push notifications (entry requests, emergencies, etc.).

**Request Body:**
```json
{
  "fcmToken": "fcm-device-token-from-firebase",
  "deviceType": "android"
}
```

**deviceType options:** `android`, `ios`

**Response 200:**
```json
{
  "success": true,
  "message": "FCM token updated"
}
```

---

### Register FCM Token (Guard App)
```http
PATCH /auth/guard-app/fcm-token
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "fcmToken": "fcm-device-token-from-firebase",
  "deviceType": "android"
}
```

---

### Create Guard (ADMIN only)
```http
POST /auth/resident-app/create-guard
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "name": "Guard Name",
  "phone": "9876543211",
  "photoUrl": "https://s3.../photo.jpg"
}
```
Note: No password. Guards log in via OTP widget only.

---

### Get All Guards (ADMIN only)
```http
GET /auth/resident-app/guards
Authorization: Bearer <admin_token>
```

---

### Toggle User Status (ADMIN only)
```http
PATCH /auth/resident-app/users/:id/status
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "isActive": false
}
```

---

### Get Profile (Guard App)
```http
GET /auth/guard-app/profile
Authorization: Bearer <guard_token>
```

---

## 2. Gate Management

### 2.1 Entry Requests

Entry requests are created by guards when unknown visitors arrive at the gate.
Residents receive a push notification with a photo to approve or reject.
Requests expire automatically after **15 minutes** if not responded to.

Auto-approval via InvitePass happens at scan time (`POST /guard/scan`), not here.
This endpoint is only for unknown visitors with no pre-existing pass.

#### Create Entry Request (Guard)
```http
POST /gate/requests
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "type": "VISITOR",
  "flatId": "uuid",
  "visitorName": "Rahul Kumar",
  "visitorPhone": "9876543212",
  "providerTag": "AMAZON",
  "photoKey": "s3-key-from-upload"
}
```

**type options:** `VISITOR`, `DELIVERY`, `DOMESTIC_STAFF`, `CAB`, `VENDOR`

**providerTag options (for DELIVERY type):** `BLINKIT`, `SWIGGY`, `ZOMATO`, `AMAZON`, `FLIPKART`, `BIGBASKET`, `DUNZO`, `OTHER`

**Response 201:**
```json
{
  "success": true,
  "message": "Entry request created. Notification sent to residents.",
  "data": {
    "entryRequest": {
      "id": "uuid",
      "type": "VISITOR",
      "status": "PENDING",
      "visitorName": "Rahul Kumar",
      "expiresAt": "2024-01-15T10:15:00Z",
      "flat": { "id": "uuid", "flatNumber": "A-101" }
    }
  }
}
```

---

#### Get Entry Requests
```http
GET /gate/requests?status=PENDING&flatId=uuid&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED` |
| flatId | string | Filter by flat ID |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |

Access by role:
- **GUARD**: sees only their own requests
- **RESIDENT**: sees requests for their flat
- **ADMIN**: sees all requests in their society

---

#### Get Entry Request Photo
```http
GET /gate/requests/:id/photo
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "viewUrl": "https://s3.presigned-url..."
  }
}
```

---

#### Approve Entry Request (Resident/Admin)
```http
PATCH /gate/requests/:id/approve
Authorization: Bearer <access_token>
```

What happens: Creates an approved `Entry` record, notifies the guard via socket with "APPROVED" status.

---

#### Reject Entry Request (Resident/Admin)
```http
PATCH /gate/requests/:id/reject
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "Not expecting any visitor"
}
```

---

#### Get Pending Count (Guard)
```http
GET /gate/requests/pending-count
Authorization: Bearer <guard_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pendingCount": 5
  }
}
```

---

### 2.2 Invite Passes

Invite Passes are the unified system for all pre-authorized gate access.
They replace pre-approvals, expected deliveries, and auto-approve rules.

**Pass types:**
| Type | Use case |
|------|----------|
| `GUEST` | One-time or recurring guest (family, friends) — QR based |
| `DELIVERY_ONCE` | Single expected delivery from one company |
| `DELIVERY_STANDING` | Recurring delivery auto-approval (e.g. always allow Swiggy) |
| `CAB` | Cab/ride-share entry |
| `SERVICE` | Service provider (plumber, electrician, etc.) |

**How guards use them:**
Guard scans the QR code at `POST /guard/scan`. The system resolves the pass and creates an `Entry` automatically if valid.

---

#### Create Invite Pass (Resident)
```http
POST /gate/invites
Authorization: Bearer <resident_token>
```

**Request Body — Guest (one-time visit):**
```json
{
  "type": "GUEST",
  "flatId": "uuid",
  "visitorName": "Rohit Patil",
  "visitorPhone": "9876543213",
  "purpose": "Birthday dinner",
  "vehicleNumber": "MH12AB1234",
  "validFrom": "2024-01-20T18:00:00Z",
  "validUntil": "2024-01-20T23:59:00Z",
  "maxUses": 1
}
```

**Request Body — Expected Delivery (single):**
```json
{
  "type": "DELIVERY_ONCE",
  "flatId": "uuid",
  "companyName": "Amazon",
  "purpose": "Laptop stand order",
  "validFrom": "2024-01-20T10:00:00Z",
  "validUntil": "2024-01-20T20:00:00Z"
}
```

**Request Body — Standing Delivery Rule:**
```json
{
  "type": "DELIVERY_STANDING",
  "flatId": "uuid",
  "companies": ["Swiggy", "Zomato", "Blinkit"],
  "allowedDays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  "timeFrom": "08:00",
  "timeUntil": "23:00",
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "maxUses": -1
}
```

Note: `maxUses: -1` means unlimited. For `DELIVERY_STANDING` this is set automatically.
`allowedDays` empty array or omitted = all days allowed.

**Request Body — Cab:**
```json
{
  "type": "CAB",
  "flatId": "uuid",
  "visitorName": "Ola/Uber Driver",
  "vehicleNumber": "MH12XY9876",
  "validFrom": "2024-01-20T14:00:00Z",
  "validUntil": "2024-01-20T15:00:00Z"
}
```

**Request Body — Service Provider:**
```json
{
  "type": "SERVICE",
  "flatId": "uuid",
  "visitorName": "Suresh Electrician",
  "visitorPhone": "9876543214",
  "purpose": "AC servicing",
  "validFrom": "2024-01-21T10:00:00Z",
  "validUntil": "2024-01-21T16:00:00Z"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Invite pass created",
  "data": {
    "id": "uuid",
    "type": "GUEST",
    "status": "ACTIVE",
    "visitorName": "Rohit Patil",
    "qrToken": "eyJ...",
    "validFrom": "2024-01-20T18:00:00Z",
    "validUntil": "2024-01-20T23:59:00Z",
    "maxUses": 1,
    "usedCount": 0,
    "createdAt": "2024-01-19T10:00:00Z"
  }
}
```

Share the `qrToken` with the visitor. They show it at the gate.

---

#### Get My Invite Passes
```http
GET /gate/invites?status=ACTIVE
Authorization: Bearer <resident_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter: `ACTIVE`, `USED`, `EXPIRED`, `CANCELLED` |

---

#### Get Invite Pass by ID
```http
GET /gate/invites/:id
Authorization: Bearer <resident_token>
```

---

#### Cancel Invite Pass
```http
PATCH /gate/invites/:id/cancel
Authorization: Bearer <resident_token>
```

**Response 200:**
```json
{
  "success": true,
  "message": "Invite cancelled",
  "data": { "id": "uuid", "status": "CANCELLED" }
}
```

---

### 2.3 Gate Passes

Gate passes are for material movement, vehicle entry, move-in/move-out, and maintenance.
Unlike Invite Passes (resident-created), Gate Passes go through admin approval.

#### Create Gate Pass
```http
POST /gate/passes
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "type": "MATERIAL",
  "flatId": "uuid",
  "subject": "Furniture Delivery",
  "validFrom": "2024-01-15T09:00:00Z",
  "validUntil": "2024-01-15T18:00:00Z",
  "details": "Sofa and dining table from Urban Ladder"
}
```

**type options:** `MATERIAL`, `VEHICLE`, `MOVE_IN`, `MOVE_OUT`, `MAINTENANCE`

---

#### Get Gate Passes
```http
GET /gate/passes?status=PENDING&type=MATERIAL
Authorization: Bearer <access_token>
```

---

#### Get Gate Pass by ID
```http
GET /gate/passes/:id
Authorization: Bearer <access_token>
```

---

#### Get Gate Pass QR Code
```http
GET /gate/passes/:id/qr
Authorization: Bearer <access_token>
```

---

#### Approve Gate Pass (Admin)
```http
PATCH /gate/passes/:id/approve
Authorization: Bearer <admin_token>
```

---

#### Reject Gate Pass (Admin)
```http
PATCH /gate/passes/:id/reject
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "reason": "Invalid documentation"
}
```

---

#### Cancel Gate Pass
```http
DELETE /gate/passes/:id
Authorization: Bearer <access_token>
```

---

#### Scan Gate Pass (Guard)
```http
POST /gate/passes/scan
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "qrToken": "gatepass-qr-token"
}
```

---

## 3. Guard App

All guard endpoints require guard authentication (`Authorization: Bearer <guard_token>`).
Base path: `/guard`

---

### Get Today's Dashboard
```http
GET /guard/today
Authorization: Bearer <guard_token>
```

Returns all entries for the current day with summary stats.

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "uuid",
        "type": "DELIVERY",
        "status": "APPROVED",
        "visitorName": "Swiggy Delivery",
        "checkInTime": "2024-01-20T13:05:00Z",
        "flat": { "id": "uuid", "flatNumber": "A-101" },
        "invitePass": { "type": "DELIVERY_STANDING", "visitorName": null },
        "createdBy": { "id": "uuid", "name": "Guard Name", "role": "GUARD" }
      }
    ],
    "stats": {
      "total": 28,
      "pending": 2,
      "approved": 22,
      "checkedOut": 4,
      "delivery": 10,
      "visitor": 15,
      "domesticStaff": 3
    }
  }
}
```

---

### Get Pending Entry Count
```http
GET /guard/pending-count
Authorization: Bearer <guard_token>
```

**Response:**
```json
{
  "success": true,
  "data": { "pendingCount": 3 }
}
```

---

### Get All Entries (with filters)
```http
GET /guard/entries?status=APPROVED&type=DELIVERY&flatId=uuid&page=1&limit=20
Authorization: Bearer <guard_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | `PENDING`, `APPROVED`, `REJECTED`, `CHECKED_IN`, `CHECKED_OUT` |
| type | string | `VISITOR`, `DELIVERY`, `DOMESTIC_STAFF`, `CAB`, `VENDOR` |
| flatId | string | Filter by flat |
| page | number | Default: 1 |
| limit | number | Default: 20 |

**Response:**
```json
{
  "success": true,
  "data": {
    "entries": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "pages": 8
    }
  }
}
```

---

### Checkout Entry (Guard)
```http
PATCH /guard/entries/:id/checkout
Authorization: Bearer <guard_token>
```

Marks the entry as `CHECKED_OUT` and records the checkout time.

---

### Create Entry Request (Unknown Visitor)
```http
POST /guard/entry-requests
Authorization: Bearer <guard_token>
```

Use this when a visitor arrives with no InvitePass QR.
The resident receives a push notification with the photo to approve or reject.

**Request Body:**
```json
{
  "type": "VISITOR",
  "flatId": "uuid",
  "visitorName": "Visitor Name",
  "visitorPhone": "9876543214",
  "providerTag": "AMAZON",
  "photoKey": "s3-photo-key"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Entry request created. Notification sent to residents.",
  "data": {
    "entryRequest": {
      "id": "uuid",
      "type": "VISITOR",
      "status": "PENDING",
      "expiresAt": "2024-01-20T14:20:00Z"
    }
  }
}
```

---

### Unified QR Scan (Preferred)
```http
POST /guard/scan
Authorization: Bearer <guard_token>
```

**The primary scan endpoint.** Accepts any QR code and automatically detects the pass type:
- InvitePass QR (GUEST, DELIVERY_ONCE, DELIVERY_STANDING, CAB, SERVICE)
- Gate Pass QR

**Request Body:**
```json
{
  "qrToken": "eyJ...",
  "gatePointId": "uuid"
}
```

`gatePointId` is optional. Used when the society has multiple gates.

**Response — Access Granted (200):**
```json
{
  "success": true,
  "message": "Access granted via GUEST invite",
  "data": {
    "type": "INVITE_PASS",
    "allowed": true,
    "entry": {
      "id": "uuid",
      "type": "VISITOR",
      "status": "APPROVED",
      "visitorName": "Rohit Patil",
      "flatId": "uuid",
      "checkInTime": "2024-01-20T18:05:00Z"
    },
    "pass": {
      "id": "uuid",
      "type": "GUEST",
      "visitorName": "Rohit Patil",
      "usedCount": 1,
      "maxUses": 1
    }
  }
}
```

**Response — Access Denied (403):**
```json
{
  "success": false,
  "message": "Invite has expired",
  "data": {
    "type": "INVITE_PASS",
    "allowed": false,
    "pass": { "id": "uuid", "status": "EXPIRED" }
  }
}
```

**Why access can be denied:**
- Pass is CANCELLED, EXPIRED, or USED (maxUses reached)
- Current time is outside `validFrom`–`validUntil` window
- Current day not in `allowedDays`
- Current time not in `timeFrom`–`timeUntil` window

---

### Scan Gate Pass QR (Legacy)
```http
POST /guard/scan/gatepass
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "qrToken": "gatepass-qr-token"
}
```

---

### Scan Staff QR (Check-In/Out)
```http
POST /guard/scan/staff
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "qrToken": "staff-qr-token",
  "flatId": "uuid",
  "societyId": "uuid"
}
```

---

### Get Active Emergencies (Guard)
```http
GET /guard/emergencies/active
Authorization: Bearer <guard_token>
```

---

### Respond to Emergency (Guard)
```http
PATCH /guard/emergencies/:id/respond
Authorization: Bearer <guard_token>
```

---

## 4. Community

### 4.1 Notices

#### Get Notices
```http
GET /community/notices?page=1&limit=20
Authorization: Bearer <access_token>
```

---

#### Get Notice by ID
```http
GET /community/notices/:id
Authorization: Bearer <access_token>
```

---

#### Create Notice (Admin)
```http
POST /community/notices
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "title": "Water Supply Disruption",
  "content": "Water supply will be interrupted on 15th Jan from 10 AM to 2 PM for maintenance.",
  "type": "MAINTENANCE",
  "priority": "HIGH",
  "attachments": ["s3-key-1", "s3-key-2"]
}
```

**type options:** `GENERAL`, `URGENT`, `EVENT`, `MAINTENANCE`, `MEETING`, `EMERGENCY`

**priority options:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

---

#### Update Notice (Admin)
```http
PATCH /community/notices/:id
Authorization: Bearer <admin_token>
```

---

#### Delete Notice (Admin)
```http
DELETE /community/notices/:id
Authorization: Bearer <admin_token>
```

---

#### Toggle Pin Status (Admin)
```http
PATCH /community/notices/:id/toggle-pin
Authorization: Bearer <admin_token>
```

---

### 4.2 Amenities & Bookings

#### Get Amenities
```http
GET /community/amenities
Authorization: Bearer <access_token>
```

---

#### Get Amenity by ID
```http
GET /community/amenities/:id
Authorization: Bearer <access_token>
```

---

#### Create Amenity (Admin)
```http
POST /community/amenities
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "name": "Community Hall",
  "type": "PARTY_HALL",
  "capacity": 100,
  "hourlyRate": 500,
  "description": "Air-conditioned hall with projector",
  "rules": "No smoking. Clean up after use."
}
```

**type options:** `CLUBHOUSE`, `GYM`, `SWIMMING_POOL`, `PARTY_HALL`, `SPORTS_COURT`, `BANQUET_HALL`, `GARDEN`, `OTHER`

---

#### Update Amenity (Admin)
```http
PATCH /community/amenities/:id
Authorization: Bearer <admin_token>
```

---

#### Delete Amenity (Admin)
```http
DELETE /community/amenities/:id
Authorization: Bearer <admin_token>
```

---

#### Get Bookings
```http
GET /community/bookings?amenityId=uuid&status=PENDING
Authorization: Bearer <access_token>
```

---

#### Create Booking
```http
POST /community/bookings
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "amenityId": "uuid",
  "fromDate": "2024-01-20T14:00:00Z",
  "toDate": "2024-01-20T18:00:00Z"
}
```

---

#### Approve Booking (Admin)
```http
PATCH /community/bookings/:id/approve
Authorization: Bearer <admin_token>
```

---

#### Cancel Booking
```http
PATCH /community/bookings/:id/cancel
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "Change of plans"
}
```

---

### 4.3 Complaints

#### Get Complaints
```http
GET /community/complaints?status=OPEN&category=MAINTENANCE&page=1&limit=20
Authorization: Bearer <access_token>
```

---

#### Get Complaint by ID
```http
GET /community/complaints/:id
Authorization: Bearer <access_token>
```

---

#### Create Complaint
```http
POST /community/complaints
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "category": "PLUMBING",
  "subject": "Leaking pipe in bathroom",
  "description": "There's a leak in the main bathroom pipe causing water seepage.",
  "priority": "HIGH",
  "images": ["s3-key-1", "s3-key-2"]
}
```

**category options:** `MAINTENANCE`, `SECURITY`, `CLEANLINESS`, `WATER`, `ELECTRICITY`, `PARKING`, `PLUMBING`, `NOISE`, `PETS`, `OTHER`

**priority options:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`

---

#### Delete Complaint
```http
DELETE /community/complaints/:id
Authorization: Bearer <access_token>
```

---

#### Update Complaint Status (Admin)
```http
PATCH /community/complaints/:id/status
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

**status options:** `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`

---

#### Assign Complaint (Admin)
```http
PATCH /community/complaints/:id/assign
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "assignedToId": "staff-user-id"
}
```

---

#### Resolve Complaint (Admin)
```http
PATCH /community/complaints/:id/resolve
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "resolution": "Pipe has been fixed and tested. No more leakage."
}
```

---

### 4.4 Emergencies

#### Create Emergency Alert
```http
POST /community/emergencies
Authorization: Bearer <access_token>
```

When created, push notifications are sent automatically:
- `FIRE` and `LIFT_STUCK`: alert ALL residents + all guards + admin
- All other types: alert guards + admin only

**Request Body:**
```json
{
  "type": "MEDICAL",
  "description": "Medical emergency in A-101. Need ambulance.",
  "location": "Block A, Flat 101"
}
```

**type options:** `MEDICAL`, `FIRE`, `SECURITY`, `LIFT_STUCK`, `ANIMAL_THREAT`, `THEFT`, `VIOLENCE`, `ACCIDENT`, `OTHER`

---

#### Get All Emergencies (Admin/Guard)
```http
GET /community/emergencies?status=ACTIVE
Authorization: Bearer <admin_or_guard_token>
```

---

#### Get My Emergencies
```http
GET /community/emergencies/my
Authorization: Bearer <access_token>
```

---

#### Get Active Emergencies (Admin/Guard)
```http
GET /community/emergencies/active
Authorization: Bearer <admin_or_guard_token>
```

Also available at `GET /guard/emergencies/active` for the guard app.

---

#### Get Emergency by ID
```http
GET /community/emergencies/:id
Authorization: Bearer <access_token>
```

---

#### Respond to Emergency (Admin/Guard)
```http
PATCH /community/emergencies/:id/respond
Authorization: Bearer <admin_or_guard_token>
```

Also available at `PATCH /guard/emergencies/:id/respond` for the guard app.

---

#### Resolve Emergency (Admin/Guard)
```http
PATCH /community/emergencies/:id/resolve
Authorization: Bearer <admin_or_guard_token>
```

**Request Body:**
```json
{
  "notes": "Ambulance arrived. Patient taken to hospital."
}
```

---

#### Mark as False Alarm
```http
PATCH /community/emergencies/:id/false-alarm
Authorization: Bearer <access_token>
```

Can be called by:
- The **reporter** who created the alert (to cancel their own)
- Any **ADMIN** or **SUPER_ADMIN**

All originally-notified users receive an "All Clear" push notification and in-app notification.

**Request Body:**
```json
{
  "notes": "Accidental trigger. No actual emergency."
}
```

**Errors:** 403 if caller is neither reporter nor admin

---

## 5. Resident

### 5.1 Onboarding

#### List Societies for Onboarding
```http
GET /resident/onboarding/societies?city=Mumbai&search=sunrise
Authorization: Bearer <onboarding_token>
```

---

#### List Blocks in Society
```http
GET /resident/onboarding/societies/:societyId/blocks
Authorization: Bearer <onboarding_token>
```

---

#### List Flats in Block
```http
GET /resident/onboarding/societies/:societyId/blocks/:blockId/flats
Authorization: Bearer <onboarding_token>
```

---

#### Submit Onboarding Request
```http
POST /resident/onboarding/request
Authorization: Bearer <onboarding_token>
```

**Request Body:**
```json
{
  "societyId": "uuid",
  "blockId": "uuid",
  "flatId": "uuid",
  "residentType": "OWNER",
  "documents": [
    {
      "type": "OWNERSHIP_PROOF",
      "s3Key": "documents/ownership-proof.pdf"
    },
    {
      "type": "AADHAR_CARD",
      "s3Key": "documents/aadhar.pdf"
    }
  ]
}
```

**residentType options:** `OWNER`, `TENANT`

**document type options:** `OWNERSHIP_PROOF`, `TENANT_AGREEMENT`, `AADHAR_CARD`, `PAN_CARD`, `PASSPORT`, `DRIVING_LICENSE`, `VOTER_ID`, `OTHER`

---

#### Get Onboarding Status
```http
GET /resident/onboarding/status
Authorization: Bearer <onboarding_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "PENDING_APPROVAL",
    "requestId": "uuid"
  }
}
```

**status options:** `DRAFT`, `PENDING_DOCS`, `PENDING_APPROVAL`, `RESUBMIT_REQUESTED`, `APPROVED`, `REJECTED`

---

#### List Pending Requests (Admin)
```http
GET /resident/onboarding/admin/pending?status=PENDING_APPROVAL&page=1&limit=20
Authorization: Bearer <admin_token>
```

---

#### Get Request Details (Admin)
```http
GET /resident/onboarding/admin/:requestId
Authorization: Bearer <admin_token>
```

---

#### Approve Request (Admin)
```http
PATCH /resident/onboarding/admin/:requestId/approve
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "notes": "All documents verified"
}
```

---

#### Reject Request (Admin)
```http
PATCH /resident/onboarding/admin/:requestId/reject
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "reason": "Invalid ownership documents"
}
```

---

#### Request Resubmission (Admin)
```http
PATCH /resident/onboarding/admin/:requestId/request-resubmit
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "reason": "Ownership proof is blurry. Please upload a clearer copy.",
  "documentsToResubmit": ["OWNERSHIP_PROOF"]
}
```

---

### 5.2 Notifications

#### Get Notifications
```http
GET /resident/notifications?page=1&limit=20&unreadOnly=true
Authorization: Bearer <access_token>
```

---

#### Get Unread Count
```http
GET /resident/notifications/unread-count
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

#### Mark as Read
```http
PATCH /resident/notifications/:id/read
Authorization: Bearer <access_token>
```

---

#### Mark All as Read
```http
PATCH /resident/notifications/read-all
Authorization: Bearer <access_token>
```

---

### 5.3 Family

#### Get Family Members
```http
GET /resident/family
Authorization: Bearer <resident_token>
```

---

#### Invite Family Member
```http
POST /resident/family/invite
Authorization: Bearer <resident_token>
```

**Request Body:**
```json
{
  "phone": "9876543215",
  "name": "Wife Name",
  "email": "wife@example.com",
  "familyRole": "SPOUSE"
}
```

**familyRole options:** `SPOUSE`, `CHILD`, `PARENT`, `SIBLING`, `OTHER`

---

#### Remove Family Member
```http
DELETE /resident/family/:memberId
Authorization: Bearer <resident_token>
```

---

#### Update Family Member Role
```http
PATCH /resident/family/:memberId/role
Authorization: Bearer <resident_token>
```

**Request Body:**
```json
{
  "familyRole": "PARENT"
}
```

---

## 6. Staff Management

### 6.1 Domestic Staff

#### Get Staff List
```http
GET /staff/domestic?staffType=MAID&page=1&limit=20
Authorization: Bearer <access_token>
```

---

#### Get Available Staff
```http
GET /staff/domestic/available
Authorization: Bearer <access_token>
```

---

#### Add Staff
```http
POST /staff/domestic
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Maid Name",
  "phone": "9876543216",
  "staffType": "MAID",
  "email": "maid@example.com"
}
```

**staffType options:** `MAID`, `COOK`, `NANNY`, `DRIVER`, `CLEANER`, `GARDENER`, `LAUNDRY`, `CARETAKER`, `SECURITY_GUARD`, `OTHER`

---

#### Get Staff by ID
```http
GET /staff/domestic/:id
Authorization: Bearer <access_token>
```

---

#### Update Staff
```http
PATCH /staff/domestic/:id
Authorization: Bearer <access_token>
```

---

#### Delete Staff
```http
DELETE /staff/domestic/:id
Authorization: Bearer <access_token>
```

---

#### Verify Staff (Admin)
```http
PATCH /staff/domestic/:id/verify
Authorization: Bearer <admin_token>
```

---

#### Get Staff QR Code
```http
GET /staff/domestic/:id/qr
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "staffId": "uuid",
    "name": "Maid Name",
    "qrToken": "unique-staff-qr-token",
    "qrCodeImage": "data:image/png;base64,..."
  }
}
```

---

#### Update Staff Availability
```http
PATCH /staff/domestic/:id/availability
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "ON_LEAVE"
}
```

**status options:** `AVAILABLE`, `BUSY`, `ON_LEAVE`, `INACTIVE`

---

#### Get Staff Assignments
```http
GET /staff/domestic/:staffId/assignments
Authorization: Bearer <access_token>
```

---

#### Get Staff Reviews
```http
GET /staff/domestic/:staffId/reviews
Authorization: Bearer <access_token>
```

---

#### Assign Staff to Flat
```http
POST /staff/domestic/assignments
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "staffId": "uuid",
  "flatId": "uuid",
  "type": "COOKING",
  "days": ["MONDAY", "WEDNESDAY", "FRIDAY"],
  "startTime": "08:00",
  "endTime": "10:00"
}
```

---

#### Update Assignment
```http
PATCH /staff/domestic/assignments/:id
Authorization: Bearer <access_token>
```

---

#### Remove Assignment
```http
DELETE /staff/domestic/assignments/:id
Authorization: Bearer <access_token>
```

---

#### Check In Staff
```http
POST /staff/domestic/check-in
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "staffId": "uuid",
  "flatId": "uuid"
}
```

---

#### Scan Staff QR (Check In/Out)
```http
POST /staff/domestic/scan
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "qrToken": "staff-qr-token",
  "flatId": "uuid",
  "societyId": "uuid"
}
```

---

#### Check Out Staff
```http
POST /staff/domestic/:staffId/check-out
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "workCompleted": true
}
```

---

#### Get Attendance Records
```http
GET /staff/domestic/attendance/records?staffId=uuid&page=1&limit=20
Authorization: Bearer <access_token>
```

---

#### Book Staff (On-Demand)
```http
POST /staff/domestic/bookings
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "staffId": "uuid",
  "flatId": "uuid",
  "date": "2024-01-20",
  "startTime": "10:00",
  "endTime": "14:00",
  "taskDescription": "Deep cleaning of kitchen and bathrooms"
}
```

---

#### Get Staff Bookings
```http
GET /staff/domestic/bookings/list
Authorization: Bearer <access_token>
```

---

#### Accept Booking
```http
PATCH /staff/domestic/bookings/:id/accept
Authorization: Bearer <access_token>
```

---

#### Reject Booking
```http
PATCH /staff/domestic/bookings/:id/reject
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "rejectionReason": "Staff not available on this date"
}
```

---

#### Complete Booking
```http
PATCH /staff/domestic/bookings/:id/complete
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "actualDuration": 240,
  "finalCost": 800
}
```

---

#### Add Staff Review
```http
POST /staff/domestic/reviews
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "staffId": "uuid",
  "rating": 4,
  "comment": "Good work, punctual and thorough"
}
```

---

### 6.2 Vendors

#### Get Vendors
```http
GET /staff/vendors?category=PLUMBER&page=1&limit=20
Authorization: Bearer <access_token>
```

---

#### Get Vendors by Category
```http
GET /staff/vendors/by-category
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "PLUMBER": [...],
    "ELECTRICIAN": [...],
    "CARPENTER": [...]
  }
}
```

---

#### Get Vendor by ID
```http
GET /staff/vendors/:id
Authorization: Bearer <access_token>
```

---

#### Create Vendor (Admin)
```http
POST /staff/vendors
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "name": "Quick Fix Plumbing",
  "phone": "9876543217",
  "category": "PLUMBER",
  "email": "quickfix@example.com",
  "address": "123 Service Street, Mumbai"
}
```

**category options:** `PLUMBER`, `ELECTRICIAN`, `CARPENTER`, `PAINTER`, `CLEANER`, `GARDENER`, `PEST_CONTROL`, `APPLIANCE_REPAIR`, `OTHER`

---

#### Update Vendor (Admin)
```http
PATCH /staff/vendors/:id
Authorization: Bearer <admin_token>
```

---

#### Verify Vendor (Admin)
```http
PATCH /staff/vendors/:id/verify
Authorization: Bearer <admin_token>
```

---

#### Delete Vendor (Admin)
```http
DELETE /staff/vendors/:id
Authorization: Bearer <admin_token>
```

---

#### Rate Vendor
```http
POST /staff/vendors/:id/rate
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "rating": 5
}
```

---

## 7. Admin

### 7.1 Societies

#### Create Society (Super Admin)
```http
POST /admin/societies
Authorization: Bearer <super_admin_token>
```

**Request Body:**
```json
{
  "name": "Sunrise Apartments",
  "city": "Mumbai",
  "address": "123 Main Road, Andheri West",
  "pincode": "400058",
  "totalBlocks": 5,
  "blockNamePrefix": "Block"
}
```

---

#### Get All Societies (Super Admin)
```http
GET /admin/societies?skip=0&take=20
Authorization: Bearer <super_admin_token>
```

---

#### Get Society by ID
```http
GET /admin/societies/:id
Authorization: Bearer <admin_token>
```

---

#### Update Society
```http
PATCH /admin/societies/:id
Authorization: Bearer <admin_token>
```

---

#### Mark Payment as Paid (Super Admin)
```http
PATCH /admin/societies/:id/payment-paid
Authorization: Bearer <super_admin_token>
```

---

#### Get Society Statistics
```http
GET /admin/societies/:id/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "residents": 150,
    "entries": 1200,
    "complaints": 45,
    "amenities": 8
  }
}
```

---

### 7.2 Reports

#### Get Dashboard Stats
```http
GET /admin/reports/dashboard
Authorization: Bearer <admin_token>
```

---

#### Get Entry Statistics
```http
GET /admin/reports/entries?days=7
Authorization: Bearer <admin_token>
```

---

#### Get Peak Hours Analysis
```http
GET /admin/reports/peak-hours?days=30
Authorization: Bearer <admin_token>
```

---

#### Get Delivery Patterns
```http
GET /admin/reports/delivery-patterns?days=30
Authorization: Bearer <admin_token>
```

---

#### Get Complaint Statistics
```http
GET /admin/reports/complaints
Authorization: Bearer <admin_token>
```

---

#### Get Visitor Frequency
```http
GET /admin/reports/visitor-frequency
Authorization: Bearer <admin_token>
```

---

#### Get Society Health Score
```http
GET /admin/reports/health-score
Authorization: Bearer <admin_token>
```

---

## 8. Upload

#### Get Pre-signed Upload URL
```http
POST /upload/presigned-url
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "context": "entry-photo",
  "fileName": "visitor.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 1024000,
  "documentType": "OTHER"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pre-signed URL generated",
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/...",
    "s3Key": "uploads/uuid/visitor.jpg"
  }
}
```

---

#### Confirm Upload
```http
POST /upload/confirm
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "s3Key": "uploads/uuid/visitor.jpg",
  "fileName": "visitor.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 1024000,
  "documentType": "OTHER",
  "onboardingRequestId": "uuid"
}
```

---

#### Get Document View URL
```http
GET /upload/:id/view-url
Authorization: Bearer <access_token>
```

---

#### Delete Document
```http
DELETE /upload/:id
Authorization: Bearer <access_token>
```

---

#### Get Entry Photo View URL
```http
GET /upload/entry-photo/:id
Authorization: Bearer <access_token>
```

---

## 9. Society Registration

A RESIDENT submits a request to register their society. SUPER_ADMIN
reviews and approves or rejects. On approval the society is created
and the requestor becomes ADMIN automatically.

---

### Submit Registration Request (any authenticated user)
```http
POST /society-registration/request
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
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
}
```

**Errors:** 409 already have active request

---

### Get My Request Status
```http
GET /society-registration/my-status
Authorization: Bearer <access_token>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "PENDING",
    "request": { "id": "uuid", "societyName": "Green Valley Apartments" }
  }
}
```

If not submitted: `"status": "NOT_SUBMITTED", "request": null`

---

### List All Requests (SUPER_ADMIN only)
```http
GET /society-registration/requests?status=PENDING&page=1&limit=20
Authorization: Bearer <super_admin_token>
```

---

### Get Single Request (SUPER_ADMIN only)
```http
GET /society-registration/requests/:id
Authorization: Bearer <super_admin_token>
```

---

### Approve Request (SUPER_ADMIN only)
```http
POST /society-registration/requests/:id/approve
Authorization: Bearer <super_admin_token>
```

No request body. What happens in one transaction:
1. Society row created from submitted details
2. Requesting user: role → ADMIN, societyId → new society
3. Request: status → APPROVED

**Errors:** 404 not found | 409 not PENDING

---

### Reject Request (SUPER_ADMIN only)
```http
POST /society-registration/requests/:id/reject
Authorization: Bearer <super_admin_token>
```

**Request Body:**
```json
{
  "rejectionReason": "Incomplete address details provided."
}
```

**Errors:** 404 not found | 409 not PENDING

---

## 10. Enums Reference

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
| `PENDING` | Awaiting resident response (15 min window) |
| `APPROVED` | Resident approved |
| `REJECTED` | Resident rejected |
| `EXPIRED` | Request expired — no response in 15 minutes |

### Invite Type
| Value | Description |
|-------|-------------|
| `GUEST` | Guest invite with QR code — family, friends |
| `DELIVERY_ONCE` | Single expected delivery |
| `DELIVERY_STANDING` | Recurring delivery rule (e.g. always allow Swiggy) |
| `CAB` | Cab/ride-share |
| `SERVICE` | Service provider (electrician, plumber, etc.) |

### Invite Status
| Value | Description |
|-------|-------------|
| `ACTIVE` | Valid and can be used |
| `USED` | Max uses reached |
| `EXPIRED` | Past `validUntil` date |
| `CANCELLED` | Manually cancelled by resident |

### Visitor Type
| Value | Description |
|-------|-------------|
| `GUEST` | General guest |
| `DELIVERY_PERSON` | Delivery agent |
| `CAB_DRIVER` | Taxi driver |
| `SERVICE_PROVIDER` | Service provider |
| `FAMILY_MEMBER` | Family member |
| `FRIEND` | Friend |
| `OTHER` | Other |

### Provider Tag (Delivery)
| Value | Description |
|-------|-------------|
| `BLINKIT` | Blinkit delivery |
| `SWIGGY` | Swiggy delivery |
| `ZOMATO` | Zomato delivery |
| `AMAZON` | Amazon delivery |
| `FLIPKART` | Flipkart delivery |
| `BIGBASKET` | BigBasket delivery |
| `DUNZO` | Dunzo delivery |
| `OTHER` | Other provider |

### Gate Pass Type
| Value | Description |
|-------|-------------|
| `MATERIAL` | Material entry/exit |
| `VEHICLE` | Vehicle pass |
| `MOVE_IN` | Moving in |
| `MOVE_OUT` | Moving out |
| `MAINTENANCE` | Maintenance work |

### Gate Pass Status
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting approval |
| `APPROVED` | Approved |
| `REJECTED` | Rejected |
| `ACTIVE` | Active/in use |
| `USED` | Already used |
| `EXPIRED` | Expired |

### Notice Type
| Value | Description |
|-------|-------------|
| `GENERAL` | General notice |
| `URGENT` | Urgent notice |
| `EVENT` | Event announcement |
| `MAINTENANCE` | Maintenance notice |
| `MEETING` | Meeting notice |
| `EMERGENCY` | Emergency alert |

### Notice Priority
| Value | Description |
|-------|-------------|
| `LOW` | Low priority |
| `MEDIUM` | Medium priority |
| `HIGH` | High priority |
| `CRITICAL` | Critical priority |

### Amenity Type
| Value | Description |
|-------|-------------|
| `CLUBHOUSE` | Clubhouse |
| `GYM` | Gymnasium |
| `SWIMMING_POOL` | Swimming pool |
| `PARTY_HALL` | Party hall |
| `SPORTS_COURT` | Sports court |
| `BANQUET_HALL` | Banquet hall |
| `GARDEN` | Garden/lawn |
| `OTHER` | Other amenity |

### Booking Status
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting approval |
| `CONFIRMED` | Confirmed |
| `CANCELLED` | Cancelled |
| `COMPLETED` | Completed |

### Complaint Category
| Value | Description |
|-------|-------------|
| `MAINTENANCE` | General maintenance |
| `SECURITY` | Security issue |
| `CLEANLINESS` | Cleanliness issue |
| `WATER` | Water supply issue |
| `ELECTRICITY` | Electrical issue |
| `PARKING` | Parking issue |
| `PLUMBING` | Plumbing issue |
| `NOISE` | Noise complaint |
| `PETS` | Pet-related issue |
| `OTHER` | Other issue |

### Complaint Status
| Value | Description |
|-------|-------------|
| `OPEN` | Open/new |
| `IN_PROGRESS` | Being worked on |
| `RESOLVED` | Resolved |
| `CLOSED` | Closed |
| `REJECTED` | Rejected |

### Complaint Priority
| Value | Description |
|-------|-------------|
| `LOW` | Low priority |
| `MEDIUM` | Medium priority |
| `HIGH` | High priority |
| `URGENT` | Urgent |

### Emergency Type
| Value | Description |
|-------|-------------|
| `MEDICAL` | Medical emergency |
| `FIRE` | Fire emergency — alerts ALL residents |
| `SECURITY` | Security breach |
| `LIFT_STUCK` | Lift/elevator stuck — alerts ALL residents |
| `ANIMAL_THREAT` | Animal threat (snake, stray dog, etc.) |
| `THEFT` | Theft/robbery |
| `VIOLENCE` | Violence |
| `ACCIDENT` | Accident |
| `OTHER` | Other emergency |

### Emergency Status
| Value | Description |
|-------|-------------|
| `ACTIVE` | Active/ongoing |
| `RESOLVED` | Resolved |
| `FALSE_ALARM` | Marked as false alarm |

### Vendor Category
| Value | Description |
|-------|-------------|
| `PLUMBER` | Plumber |
| `ELECTRICIAN` | Electrician |
| `CARPENTER` | Carpenter |
| `PAINTER` | Painter |
| `CLEANER` | Cleaner |
| `GARDENER` | Gardener |
| `PEST_CONTROL` | Pest control |
| `APPLIANCE_REPAIR` | Appliance repair |
| `OTHER` | Other |

### Domestic Staff Type
| Value | Description |
|-------|-------------|
| `MAID` | House maid |
| `COOK` | Cook |
| `NANNY` | Nanny/babysitter |
| `DRIVER` | Driver |
| `CLEANER` | Cleaner |
| `GARDENER` | Gardener |
| `LAUNDRY` | Laundry person |
| `CARETAKER` | Caretaker |
| `SECURITY_GUARD` | Security guard |
| `OTHER` | Other |

### Staff Availability Status
| Value | Description |
|-------|-------------|
| `AVAILABLE` | Available for work |
| `BUSY` | Currently busy |
| `ON_LEAVE` | On leave |
| `INACTIVE` | Inactive |

### Staff Booking Status
| Value | Description |
|-------|-------------|
| `PENDING` | Pending acceptance |
| `CONFIRMED` | Confirmed |
| `IN_PROGRESS` | Work in progress |
| `COMPLETED` | Completed |
| `CANCELLED` | Cancelled |

### Family Role
| Value | Description |
|-------|-------------|
| `SPOUSE` | Spouse |
| `CHILD` | Child |
| `PARENT` | Parent |
| `SIBLING` | Sibling |
| `OTHER` | Other relation |

### Onboarding Status
| Value | Description |
|-------|-------------|
| `DRAFT` | Draft/incomplete |
| `PENDING_DOCS` | Awaiting documents |
| `PENDING_APPROVAL` | Awaiting admin approval |
| `RESUBMIT_REQUESTED` | Resubmission requested |
| `APPROVED` | Approved |
| `REJECTED` | Rejected |

### Resident Type
| Value | Description |
|-------|-------------|
| `OWNER` | Property owner |
| `TENANT` | Tenant |

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

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
