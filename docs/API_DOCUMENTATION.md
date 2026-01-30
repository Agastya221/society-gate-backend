# Society Gate Backend - API Documentation

**Base URL:** `http://localhost:3000/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Gate Management](#2-gate-management)
   - [Entry Requests](#21-entry-requests)
   - [Pre-Approvals & Entries](#22-pre-approvals--entries)
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
9. [Enums Reference](#9-enums-reference)

---

## Authentication Headers

All authenticated endpoints require:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 1. Authentication

### Send OTP (Resident)
```http
POST /auth/otp/send
```

**Request Body:**
```json
{
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

---

### Verify OTP & Login
```http
POST /auth/otp/verify
```

**Request Body:**
```json
{
  "phone": "9876543210",
  "otp": "123456",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "requiresOnboarding": true,
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "9876543210",
      "email": "john@example.com",
      "role": "RESIDENT"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Admin/Resident App Login
```http
POST /auth/admin-app/login
```

**Request Body:**
```json
{
  "email": "admin@society.com",
  "password": "securepassword123"
}
```
or
```json
{
  "phone": "9876543210",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Admin User",
      "role": "ADMIN",
      "societyId": "uuid"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Guard App Login
```http
POST /auth/guard-app/login
```

**Request Body:**
```json
{
  "phone": "9876543210",
  "password": "guardpass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Guard Name",
      "role": "GUARD",
      "societyId": "uuid"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### Refresh Token
```http
POST /auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "new-access-token...",
    "refreshToken": "new-refresh-token..."
  }
}
```

---

### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### Get Resident Profile
```http
GET /auth/resident-app/profile
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "9876543210",
    "email": "john@example.com",
    "role": "RESIDENT",
    "societyId": "uuid",
    "flatId": "uuid",
    "flat": {
      "id": "uuid",
      "number": "A-101",
      "block": { "name": "Block A" }
    }
  }
}
```

---

### Update Resident Profile
```http
PATCH /auth/resident-app/profile
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

---

### Create Guard (Admin Only)
```http
POST /auth/resident-app/create-guard
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "Guard Name",
  "phone": "9876543211",
  "email": "guard@society.com",
  "password": "guardpass123"
}
```

---

### Get All Guards (Admin Only)
```http
GET /auth/resident-app/guards
Authorization: Bearer <access_token>
```

---

### Toggle User Status (Admin Only)
```http
PATCH /auth/resident-app/users/:id/status
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "isActive": false
}
```

---

## 2. Gate Management

### 2.1 Entry Requests

Entry requests are created by guards when unknown visitors arrive at the gate. Residents receive a notification to approve/reject.

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
  "visitorName": "Delivery Person",
  "visitorPhone": "9876543212",
  "providerTag": "AMAZON",
  "photoKey": "s3-key-from-upload"
}
```

**type options:** `VISITOR`, `DELIVERY`, `DOMESTIC_STAFF`, `CAB`, `VENDOR`

**providerTag options:** `BLINKIT`, `SWIGGY`, `ZOMATO`, `AMAZON`, `FLIPKART`, `BIGBASKET`, `DUNZO`, `OTHER`

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

### 2.2 Pre-Approvals & Entries

Pre-approvals let residents generate QR codes for expected visitors.

#### Create Pre-Approval (Resident)
```http
POST /gate/
Authorization: Bearer <resident_token>
```

**Request Body:**
```json
{
  "visitorName": "Guest Name",
  "visitorPhone": "9876543213",
  "flatId": "uuid",
  "validFrom": "2024-01-15T09:00:00Z",
  "validUntil": "2024-01-15T18:00:00Z",
  "visitorType": "GUEST"
}
```

**visitorType options:** `GUEST`, `DELIVERY_PERSON`, `CAB_DRIVER`, `SERVICE_PROVIDER`, `FAMILY_MEMBER`, `FRIEND`, `OTHER`

**Response:**
```json
{
  "success": true,
  "message": "Pre-approval created successfully. Share QR code with your guest.",
  "data": {
    "id": "uuid",
    "qrToken": "unique-qr-token"
  }
}
```

---

#### Get My Pre-Approvals
```http
GET /gate/?status=ACTIVE
Authorization: Bearer <resident_token>
```

**status options:** `ACTIVE`, `EXPIRED`, `USED`, `CANCELLED`

---

#### Get Pre-Approval QR Code
```http
GET /gate/:id/qr
Authorization: Bearer <resident_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "qrToken": "unique-qr-token",
    "qrCodeImage": "data:image/png;base64,..."
  }
}
```

---

#### Cancel Pre-Approval
```http
DELETE /gate/:id
Authorization: Bearer <resident_token>
```

---

#### Scan Pre-Approval QR (Guard)
```http
POST /gate/scan
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "qrToken": "unique-qr-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "John Doe pre-approved. Entry created for flat A-101.",
  "data": {
    "preApproval": {
      "visitorName": "John Doe",
      "flatNumber": "A-101"
    },
    "entry": {
      "id": "uuid",
      "status": "CHECKED_IN"
    }
  }
}
```

---

#### Create Expected Delivery
```http
POST /gate/deliveries/expected
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "flatId": "uuid",
  "company": "Amazon",
  "expectedDate": "2024-01-15",
  "trackingId": "AMZN123456"
}
```

---

#### Get Expected Deliveries
```http
GET /gate/deliveries/expected
Authorization: Bearer <access_token>
```

---

#### Create Auto-Approve Rule
```http
POST /gate/deliveries/auto-approve
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "company": "Swiggy",
  "autoApprove": true
}
```

---

#### Get Auto-Approve Rules
```http
GET /gate/deliveries/auto-approve
Authorization: Bearer <access_token>
```

---

#### Toggle Auto-Approve Rule
```http
PATCH /gate/deliveries/auto-approve/:id
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "isActive": false
}
```

---

#### Delete Auto-Approve Rule
```http
DELETE /gate/deliveries/auto-approve/:id
Authorization: Bearer <access_token>
```

---

#### Get Popular Delivery Companies
```http
GET /gate/deliveries/companies
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companies": ["Amazon", "Flipkart", "Swiggy", "Zomato", "Blinkit", "BigBasket", "Dunzo"]
  }
}
```

---

#### Get All Entries
```http
GET /gate/entries?flatId=uuid&status=CHECKED_IN&type=DELIVERY&page=1&limit=20
Authorization: Bearer <access_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| flatId | string | Filter by flat |
| status | string | `PENDING`, `APPROVED`, `REJECTED`, `CHECKED_IN`, `CHECKED_OUT` |
| type | string | `VISITOR`, `DELIVERY`, `DOMESTIC_STAFF`, `CAB`, `VENDOR` |
| page | number | Page number |
| limit | number | Items per page |

---

#### Get Pending Approvals
```http
GET /gate/entries/pending
Authorization: Bearer <access_token>
```

---

#### Get Today's Entries (Guard)
```http
GET /gate/entries/today
Authorization: Bearer <guard_token>
```

---

#### Checkout Entry (Guard)
```http
PATCH /gate/entries/:id/checkout
Authorization: Bearer <guard_token>
```

---

### 2.3 Gate Passes

Gate passes are for material movement, vehicle entry, move-in/move-out, and maintenance.

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

All guard endpoints require guard authentication.

### Get Today's Dashboard
```http
GET /guard/today
Authorization: Bearer <guard_token>
```

---

### Get Pending Entry Count
```http
GET /guard/pending-count
Authorization: Bearer <guard_token>
```

---

### Get Entries
```http
GET /guard/entries
Authorization: Bearer <guard_token>
```

---

### Checkout Entry
```http
PATCH /guard/entries/:id/checkout
Authorization: Bearer <guard_token>
```

---

### Create Entry Request
```http
POST /guard/entry-requests
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "type": "VISITOR",
  "flatId": "uuid",
  "visitorName": "Visitor Name",
  "visitorPhone": "9876543214",
  "photoKey": "s3-photo-key"
}
```

---

### Scan Pre-Approval QR
```http
POST /guard/scan/preapproval
Authorization: Bearer <guard_token>
```

**Request Body:**
```json
{
  "qrToken": "preapproval-qr-token"
}
```

---

### Scan Gate Pass QR
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

### Scan Staff QR
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

**Request Body:**
```json
{
  "type": "MEDICAL",
  "description": "Medical emergency in A-101. Need ambulance.",
  "location": "Block A, Flat 101"
}
```

**type options:** `MEDICAL`, `FIRE`, `THEFT`, `VIOLENCE`, `ACCIDENT`, `OTHER`

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

#### Mark as False Alarm (Admin)
```http
PATCH /community/emergencies/:id/false-alarm
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{
  "notes": "Accidental trigger. No actual emergency."
}
```

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

## 9. Enums Reference

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
| `USED` | Already scanned |
| `CANCELLED` | Cancelled by resident |

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
| `FIRE` | Fire emergency |
| `THEFT` | Theft/robbery |
| `VIOLENCE` | Violence |
| `ACCIDENT` | Accident |
| `OTHER` | Other emergency |

### Emergency Status
| Value | Description |
|-------|-------------|
| `ACTIVE` | Active/ongoing |
| `RESOLVED` | Resolved |
| `FALSE_ALARM` | False alarm |

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

## Testing with cURL

### Login as Admin
```bash
curl -X POST http://localhost:3000/api/v1/auth/admin-app/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@society.com", "password": "password123"}'
```

### Create Entry Request (Guard)
```bash
curl -X POST http://localhost:3000/api/v1/gate/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <guard_token>" \
  -d '{
    "type": "DELIVERY",
    "flatId": "flat-uuid",
    "visitorName": "Amazon Delivery",
    "visitorPhone": "9876543210",
    "providerTag": "AMAZON"
  }'
```

### Create Pre-Approval (Resident)
```bash
curl -X POST http://localhost:3000/api/v1/gate/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <resident_token>" \
  -d '{
    "visitorName": "John Friend",
    "visitorPhone": "9876543211",
    "flatId": "flat-uuid",
    "validFrom": "2024-01-15T09:00:00Z",
    "validUntil": "2024-01-15T18:00:00Z",
    "visitorType": "FRIEND"
  }'
```

### Create Complaint
```bash
curl -X POST http://localhost:3000/api/v1/community/complaints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "category": "PLUMBING",
    "subject": "Bathroom leak",
    "description": "Water leaking from bathroom pipe",
    "priority": "HIGH"
  }'
```

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
