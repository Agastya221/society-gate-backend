# Society Gate Backend - API Testing Documentation

> Complete guide for manually testing all API endpoints with sample request data

**Base URL:** `http://localhost:3000/api/v1`

---

## Table of Contents

1. [Health Check](#1-health-check)
2. [Authentication](#2-authentication)
3. [Gate Management](#3-gate-management)
4. [Staff Management](#4-staff-management)
5. [Community Management](#5-community-management)
6. [Resident Routes](#6-resident-routes)
7. [Deliveries](#7-deliveries)
8. [Upload](#8-upload)
9. [Admin Routes](#9-admin-routes)
10. [Guard App Routes](#10-guard-app-routes)

---

## Authentication Header

Most endpoints require authentication. Include this header:

```
Authorization: Bearer <your_access_token>
```

---

## 1. Health Check

### GET `/health`
Check API and services status.

```bash
curl -X GET http://localhost:3000/api/v1/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": "5ms",
  "services": {
    "api": "healthy",
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## 2. Authentication

### POST `/auth/otp/send`
Send OTP to phone number.

```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210"
  }'
```

### POST `/auth/otp/verify`
Verify OTP and register/login user.

```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456",
    "name": "John Doe",
    "email": "john@example.com"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "clx...",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "role": "RESIDENT"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "onboardingStatus": "PENDING"
}
```

### POST `/auth/admin-app/login`
Admin login with credentials.

```bash
curl -X POST http://localhost:3000/api/v1/auth/admin-app/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@society.com",
    "password": "AdminPass123!"
  }'
```

**Or with phone:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/admin-app/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "password": "AdminPass123!"
  }'
```

### POST `/auth/guard-app/login`
Guard login.

```bash
curl -X POST http://localhost:3000/api/v1/auth/guard-app/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543211",
    "password": "GuardPass123!"
  }'
```

### POST `/auth/refresh-token`
Refresh access token.

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### POST `/auth/logout`
Logout user.

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer <access_token>"
```

### GET `/auth/resident-app/profile`
Get current user profile.

```bash
curl -X GET http://localhost:3000/api/v1/auth/resident-app/profile \
  -H "Authorization: Bearer <access_token>"
```

### PATCH `/auth/resident-app/profile`
Update user profile.

```bash
curl -X PATCH http://localhost:3000/api/v1/auth/resident-app/profile \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Updated",
    "email": "john.updated@example.com"
  }'
```

### POST `/auth/resident-app/create-guard`
Create a guard user (Admin only).

```bash
curl -X POST http://localhost:3000/api/v1/auth/resident-app/create-guard \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543212",
    "password": "NewGuard123!",
    "name": "Security Guard 1"
  }'
```

### GET `/auth/resident-app/guards`
Get all guards in society (Admin only).

```bash
curl -X GET http://localhost:3000/api/v1/auth/resident-app/guards \
  -H "Authorization: Bearer <admin_access_token>"
```

### PATCH `/auth/resident-app/users/:id/status`
Update user status (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/auth/resident-app/users/clx123abc/status \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

### GET `/auth/guard-app/profile`
Get guard profile.

```bash
curl -X GET http://localhost:3000/api/v1/auth/guard-app/profile \
  -H "Authorization: Bearer <guard_access_token>"
```

---

## 3. Gate Management

### 3.1 Entries

#### GET `/gate/entries`
Get all entries with filters.

```bash
curl -X GET "http://localhost:3000/api/v1/gate/entries?page=1&limit=20&status=PENDING" \
  -H "Authorization: Bearer <access_token>"
```

**Query Parameters:**
- `flatId` (optional): Filter by flat
- `status` (optional): `PENDING`, `APPROVED`, `REJECTED`, `CHECKED_OUT`
- `type` (optional): `VISITOR`, `VENDOR`, `DELIVERY`, `CONTRACTOR`, `DOMESTIC_STAFF`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

#### GET `/gate/entries/pending`
Get pending approvals.

```bash
curl -X GET "http://localhost:3000/api/v1/gate/entries/pending?page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/gate/entries/today`
Get today's entries (Guard only).

```bash
curl -X GET http://localhost:3000/api/v1/gate/entries/today \
  -H "Authorization: Bearer <guard_access_token>"
```

#### POST `/gate/entries`
Create a new entry (Guard only).

```bash
curl -X POST http://localhost:3000/api/v1/gate/entries \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "flatId": "clx_flat_id_123",
    "type": "VISITOR",
    "visitorName": "Jane Smith",
    "visitorPhone": "+919876543213",
    "notes": "Meeting with resident"
  }'
```

**Entry Types:**
- `VISITOR` - General visitor
- `VENDOR` - Service vendor
- `DELIVERY` - Package delivery
- `CONTRACTOR` - Construction/repair worker
- `DOMESTIC_STAFF` - Maid, cook, etc.

#### PATCH `/gate/entries/:id/approve`
Approve an entry.

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/entries/clx_entry_id/approve \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/gate/entries/:id/reject`
Reject an entry.

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/entries/clx_entry_id/reject \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Not expecting any visitors today"
  }'
```

#### PATCH `/gate/entries/:id/checkout`
Check out an entry (Guard only).

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/entries/clx_entry_id/checkout \
  -H "Authorization: Bearer <guard_access_token>"
```

### 3.2 Entry Requests

#### POST `/gate/requests`
Create entry request with photo (Guard only).

```bash
curl -X POST http://localhost:3000/api/v1/gate/requests \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "VISITOR",
    "flatId": "clx_flat_id_123",
    "visitorName": "Mike Johnson",
    "visitorPhone": "+919876543214",
    "providerTag": "Amazon",
    "photoKey": "entry-photos/photo123.jpg"
  }'
```

#### GET `/gate/requests`
Get entry requests.

```bash
curl -X GET "http://localhost:3000/api/v1/gate/requests?status=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/gate/requests/pending-count`
Get pending requests count.

```bash
curl -X GET http://localhost:3000/api/v1/gate/requests/pending-count \
  -H "Authorization: Bearer <guard_access_token>"
```

#### GET `/gate/requests/:id`
Get request details.

```bash
curl -X GET http://localhost:3000/api/v1/gate/requests/clx_request_id \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/gate/requests/:id/photo`
Get visitor photo URL.

```bash
curl -X GET http://localhost:3000/api/v1/gate/requests/clx_request_id/photo \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/gate/requests/:id/approve`
Approve request.

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/requests/clx_request_id/approve \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/gate/requests/:id/reject`
Reject request.

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/requests/clx_request_id/reject \
  -H "Authorization: Bearer <access_token>"
```

### 3.3 Gate Passes

#### POST `/gate/passes`
Create a gate pass with QR code.

```bash
curl -X POST http://localhost:3000/api/v1/gate/passes \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "visitorName": "Robert Brown",
    "visitorPhone": "+919876543215",
    "visitorEmail": "robert@example.com",
    "visitorType": "VISITOR",
    "purpose": "Birthday party",
    "expiresAt": "2024-01-20T18:00:00.000Z",
    "flatId": "clx_flat_id_123"
  }'
```

#### GET `/gate/passes`
Get all gate passes.

```bash
curl -X GET http://localhost:3000/api/v1/gate/passes \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/gate/passes/:id`
Get gate pass details.

```bash
curl -X GET http://localhost:3000/api/v1/gate/passes/clx_pass_id \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/gate/passes/:id/qr`
Get QR code for gate pass.

```bash
curl -X GET http://localhost:3000/api/v1/gate/passes/clx_pass_id/qr \
  -H "Authorization: Bearer <access_token>"
```

**Response contains base64 QR image.**

#### POST `/gate/passes/scan`
Scan gate pass QR (Guard only).

```bash
curl -X POST http://localhost:3000/api/v1/gate/passes/scan \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "gp_abc123xyz789"
  }'
```

#### PATCH `/gate/passes/:id/approve`
Approve gate pass (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/passes/clx_pass_id/approve \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/gate/passes/:id/reject`
Reject gate pass (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/gate/passes/clx_pass_id/reject \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Security concern"
  }'
```

#### DELETE `/gate/passes/:id`
Delete gate pass.

```bash
curl -X DELETE http://localhost:3000/api/v1/gate/passes/clx_pass_id \
  -H "Authorization: Bearer <access_token>"
```

### 3.4 Pre-Approvals

#### POST `/gate/preapprovals`
Create pre-approval for expected visitor.

```bash
curl -X POST http://localhost:3000/api/v1/gate/preapprovals \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "visitorName": "Alice Williams",
    "visitorPhone": "+919876543216",
    "visitorEmail": "alice@example.com",
    "purpose": "Document delivery",
    "expiresAt": "2024-01-18T20:00:00.000Z",
    "flatId": "clx_flat_id_123"
  }'
```

#### GET `/gate/preapprovals`
Get pre-approvals.

```bash
curl -X GET "http://localhost:3000/api/v1/gate/preapprovals?status=ACTIVE" \
  -H "Authorization: Bearer <access_token>"
```

**Status options:** `ACTIVE`, `EXPIRED`, `USED`

#### GET `/gate/preapprovals/:id/qr`
Get QR code for pre-approval.

```bash
curl -X GET http://localhost:3000/api/v1/gate/preapprovals/clx_preapproval_id/qr \
  -H "Authorization: Bearer <access_token>"
```

#### DELETE `/gate/preapprovals/:id`
Cancel pre-approval.

```bash
curl -X DELETE http://localhost:3000/api/v1/gate/preapprovals/clx_preapproval_id \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/gate/preapprovals/scan`
Scan pre-approval QR (Guard only).

```bash
curl -X POST http://localhost:3000/api/v1/gate/preapprovals/scan \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "pa_abc123xyz789"
  }'
```

---

## 4. Staff Management

### 4.1 Domestic Staff

#### GET `/staff/domestic`
Get all domestic staff.

```bash
curl -X GET "http://localhost:3000/api/v1/staff/domestic?staffType=MAID&page=1&limit=20" \
  -H "Authorization: Bearer <access_token>"
```

**Staff Types:** `COOK`, `MAID`, `DRIVER`, `GARDENER`, `CARETAKER`, `NANNY`, `OTHER`

#### GET `/staff/domestic/available`
Get available staff for hiring.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/available \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/staff/domestic`
Register new domestic staff.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lakshmi Devi",
    "phone": "+919876543217",
    "staffType": "MAID",
    "experience": "5 years",
    "qualifications": "House cleaning, cooking basics",
    "hourlyRate": 150
  }'
```

#### GET `/staff/domestic/:id`
Get staff details.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/clx_staff_id \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/staff/domestic/:id/qr`
Get staff QR code.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/clx_staff_id/qr \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/staff/domestic/:id`
Update staff details.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/clx_staff_id \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hourlyRate": 175,
    "qualifications": "House cleaning, cooking basics, child care"
  }'
```

#### DELETE `/staff/domestic/:id`
Remove staff.

```bash
curl -X DELETE http://localhost:3000/api/v1/staff/domestic/clx_staff_id \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/staff/domestic/:id/verify`
Verify staff (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/clx_staff_id/verify \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/staff/domestic/:id/availability`
Update staff availability.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/clx_staff_id/availability \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true
  }'
```

#### GET `/staff/domestic/:staffId/assignments`
Get staff assignments.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/clx_staff_id/assignments \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/staff/domestic/:staffId/reviews`
Get staff reviews.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/clx_staff_id/reviews \
  -H "Authorization: Bearer <access_token>"
```

### 4.2 Staff Assignments

#### POST `/staff/domestic/assignments`
Assign staff to flat.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/assignments \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "clx_staff_id",
    "flatId": "clx_flat_id_123",
    "assignmentType": "REGULAR",
    "startDate": "2024-01-15",
    "endDate": "2024-12-31"
  }'
```

#### PATCH `/staff/domestic/assignments/:id`
Update assignment.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/assignments/clx_assignment_id \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "endDate": "2024-06-30"
  }'
```

#### DELETE `/staff/domestic/assignments/:id`
Remove assignment.

```bash
curl -X DELETE http://localhost:3000/api/v1/staff/domestic/assignments/clx_assignment_id \
  -H "Authorization: Bearer <access_token>"
```

### 4.3 Staff Attendance

#### POST `/staff/domestic/check-in`
Manual check-in.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/check-in \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "clx_staff_id"
  }'
```

#### POST `/staff/domestic/scan`
Scan staff QR for attendance.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/scan \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "staff_abc123xyz789"
  }'
```

#### POST `/staff/domestic/:staffId/check-out`
Check out staff.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/clx_staff_id/check-out \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Left early due to personal emergency"
  }'
```

#### GET `/staff/domestic/attendance/records`
Get attendance records.

```bash
curl -X GET "http://localhost:3000/api/v1/staff/domestic/attendance/records?staffId=clx_staff_id&startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer <access_token>"
```

### 4.4 Staff Bookings

#### POST `/staff/domestic/bookings`
Book staff for specific duration.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/bookings \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "clx_staff_id",
    "startDate": "2024-01-20T09:00:00.000Z",
    "endDate": "2024-01-20T13:00:00.000Z",
    "duration": 4,
    "notes": "Deep cleaning required"
  }'
```

#### GET `/staff/domestic/bookings/list`
Get bookings list.

```bash
curl -X GET http://localhost:3000/api/v1/staff/domestic/bookings/list \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/staff/domestic/bookings/:id/accept`
Accept booking.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/bookings/clx_booking_id/accept \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/staff/domestic/bookings/:id/reject`
Reject booking.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/bookings/clx_booking_id/reject \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/staff/domestic/bookings/:id/complete`
Mark booking complete.

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/domestic/bookings/clx_booking_id/complete \
  -H "Authorization: Bearer <access_token>"
```

### 4.5 Staff Reviews

#### POST `/staff/domestic/reviews`
Add staff review.

```bash
curl -X POST http://localhost:3000/api/v1/staff/domestic/reviews \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "clx_staff_id",
    "rating": 5,
    "review": "Excellent work, very punctual and thorough cleaning."
  }'
```

### 4.6 Vendors

#### GET `/staff/vendors`
Get all vendors.

```bash
curl -X GET http://localhost:3000/api/v1/staff/vendors \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/staff/vendors/by-category`
Get vendors by category.

```bash
curl -X GET "http://localhost:3000/api/v1/staff/vendors/by-category?category=ELECTRICIAN" \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/staff/vendors/:id`
Get vendor details.

```bash
curl -X GET http://localhost:3000/api/v1/staff/vendors/clx_vendor_id \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/staff/vendors`
Create vendor (Admin only).

```bash
curl -X POST http://localhost:3000/api/v1/staff/vendors \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Fix Electricals",
    "phone": "+919876543218",
    "email": "quickfix@example.com",
    "category": "ELECTRICIAN",
    "description": "24/7 electrical repair services",
    "website": "https://quickfix.com"
  }'
```

#### PATCH `/staff/vendors/:id`
Update vendor (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/vendors/clx_vendor_id \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "24/7 electrical and plumbing services"
  }'
```

#### PATCH `/staff/vendors/:id/verify`
Verify vendor (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/staff/vendors/clx_vendor_id/verify \
  -H "Authorization: Bearer <admin_access_token>"
```

#### DELETE `/staff/vendors/:id`
Delete vendor (Admin only).

```bash
curl -X DELETE http://localhost:3000/api/v1/staff/vendors/clx_vendor_id \
  -H "Authorization: Bearer <admin_access_token>"
```

#### POST `/staff/vendors/:id/rate`
Rate a vendor.

```bash
curl -X POST http://localhost:3000/api/v1/staff/vendors/clx_vendor_id/rate \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "review": "Good service, fixed the issue quickly."
  }'
```

---

## 5. Community Management

### 5.1 Notices

#### GET `/community/notices`
Get all notices.

```bash
curl -X GET http://localhost:3000/api/v1/community/notices \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/community/notices/:id`
Get notice details.

```bash
curl -X GET http://localhost:3000/api/v1/community/notices/clx_notice_id \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/community/notices`
Create notice (Admin only).

```bash
curl -X POST http://localhost:3000/api/v1/community/notices \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Water Supply Maintenance",
    "content": "Water supply will be interrupted on Jan 20th from 10 AM to 2 PM due to maintenance work.",
    "category": "MAINTENANCE",
    "priority": "HIGH",
    "expiresAt": "2024-01-21T00:00:00.000Z"
  }'
```

**Priority options:** `HIGH`, `MEDIUM`, `LOW`

#### PATCH `/community/notices/:id`
Update notice (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/notices/clx_notice_id \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Water supply will be interrupted on Jan 20th from 10 AM to 4 PM due to extended maintenance work."
  }'
```

#### DELETE `/community/notices/:id`
Delete notice (Admin only).

```bash
curl -X DELETE http://localhost:3000/api/v1/community/notices/clx_notice_id \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/community/notices/:id/toggle-pin`
Pin/unpin notice (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/notices/clx_notice_id/toggle-pin \
  -H "Authorization: Bearer <admin_access_token>"
```

### 5.2 Amenities

#### GET `/community/amenities/amenities`
Get all amenities.

```bash
curl -X GET http://localhost:3000/api/v1/community/amenities/amenities \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/community/amenities/amenities/:id`
Get amenity details.

```bash
curl -X GET http://localhost:3000/api/v1/community/amenities/amenities/clx_amenity_id \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/community/amenities/amenities`
Create amenity (Admin only).

```bash
curl -X POST http://localhost:3000/api/v1/community/amenities/amenities \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Swimming Pool",
    "description": "Olympic size swimming pool with changing rooms",
    "type": "POOL",
    "capacity": 50
  }'
```

**Amenity Types:** `POOL`, `GYM`, `PARK`, `HALL`, `GARDEN`, `COURT`, `CLUB`, `OTHER`

#### PATCH `/community/amenities/amenities/:id`
Update amenity (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/amenities/amenities/clx_amenity_id \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "capacity": 60
  }'
```

#### DELETE `/community/amenities/amenities/:id`
Delete amenity (Admin only).

```bash
curl -X DELETE http://localhost:3000/api/v1/community/amenities/amenities/clx_amenity_id \
  -H "Authorization: Bearer <admin_access_token>"
```

### 5.3 Amenity Bookings

#### GET `/community/amenities/bookings`
Get amenity bookings.

```bash
curl -X GET http://localhost:3000/api/v1/community/amenities/bookings \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/community/amenities/bookings`
Book an amenity.

```bash
curl -X POST http://localhost:3000/api/v1/community/amenities/bookings \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amenityId": "clx_amenity_id",
    "startTime": "2024-01-20T10:00:00.000Z",
    "endTime": "2024-01-20T12:00:00.000Z",
    "numberOfPeople": 10,
    "notes": "Family gathering"
  }'
```

#### PATCH `/community/amenities/bookings/:id/approve`
Approve booking (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/amenities/bookings/clx_booking_id/approve \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/community/amenities/bookings/:id/cancel`
Cancel booking.

```bash
curl -X PATCH http://localhost:3000/api/v1/community/amenities/bookings/clx_booking_id/cancel \
  -H "Authorization: Bearer <access_token>"
```

### 5.4 Complaints

#### GET `/community/complaints`
Get complaints.

```bash
curl -X GET "http://localhost:3000/api/v1/community/complaints?status=OPEN&category=PLUMBING&page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```

**Status options:** `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
**Category options:** `PLUMBING`, `ELECTRICAL`, `STRUCTURAL`, `CLEANLINESS`, `MAINTENANCE`, `NOISE`, `OTHER`

#### GET `/community/complaints/:id`
Get complaint details.

```bash
curl -X GET http://localhost:3000/api/v1/community/complaints/clx_complaint_id \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/community/complaints`
Create complaint.

```bash
curl -X POST http://localhost:3000/api/v1/community/complaints \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "PLUMBING",
    "subject": "Leaking pipe in bathroom",
    "description": "There is a continuous water leak from the pipe under the bathroom sink. It has been going on for 2 days.",
    "severity": "HIGH",
    "images": ["complaints/image1.jpg", "complaints/image2.jpg"]
  }'
```

**Severity options:** `LOW`, `MEDIUM`, `HIGH`

#### DELETE `/community/complaints/:id`
Delete complaint.

```bash
curl -X DELETE http://localhost:3000/api/v1/community/complaints/clx_complaint_id \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/community/complaints/:id/status`
Update complaint status (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/complaints/clx_complaint_id/status \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

#### PATCH `/community/complaints/:id/assign`
Assign complaint (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/complaints/clx_complaint_id/assign \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedToId": "clx_user_or_staff_id"
  }'
```

#### PATCH `/community/complaints/:id/resolve`
Resolve complaint (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/complaints/clx_complaint_id/resolve \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "Pipe has been replaced and leak has been fixed."
  }'
```

### 5.5 Emergencies

#### POST `/community/emergencies`
Create emergency alert.

```bash
curl -X POST http://localhost:3000/api/v1/community/emergencies \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MEDICAL",
    "description": "Senior citizen fell down and needs immediate medical attention",
    "location": "Block A, Flat 302"
  }'
```

**Emergency Types:** `MEDICAL`, `FIRE`, `SECURITY`, `ACCIDENT`, `GAS_LEAK`, `OTHER`

#### GET `/community/emergencies/my`
Get my emergency alerts.

```bash
curl -X GET http://localhost:3000/api/v1/community/emergencies/my \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/community/emergencies/active`
Get active emergencies (Admin/Guard only).

```bash
curl -X GET http://localhost:3000/api/v1/community/emergencies/active \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/community/emergencies`
Get all emergencies (Admin/Guard only).

```bash
curl -X GET http://localhost:3000/api/v1/community/emergencies \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/community/emergencies/:id`
Get emergency details.

```bash
curl -X GET http://localhost:3000/api/v1/community/emergencies/clx_emergency_id \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/community/emergencies/:id/respond`
Respond to emergency (Admin/Guard only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/emergencies/clx_emergency_id/respond \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "response": "Ambulance has been called. ETA 10 minutes."
  }'
```

#### PATCH `/community/emergencies/:id/resolve`
Resolve emergency (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/emergencies/clx_emergency_id/resolve \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Patient taken to hospital. Family informed."
  }'
```

#### PATCH `/community/emergencies/:id/false-alarm`
Mark as false alarm (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/community/emergencies/clx_emergency_id/false-alarm \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 6. Resident Routes

### 6.1 Onboarding

#### GET `/resident/onboarding/societies`
Get available societies.

```bash
curl -X GET "http://localhost:3000/api/v1/resident/onboarding/societies?city=Mumbai&search=green" \
  -H "Authorization: Bearer <onboarding_token>"
```

#### GET `/resident/onboarding/societies/:societyId/blocks`
Get blocks in society.

```bash
curl -X GET http://localhost:3000/api/v1/resident/onboarding/societies/clx_society_id/blocks \
  -H "Authorization: Bearer <onboarding_token>"
```

#### GET `/resident/onboarding/societies/:societyId/blocks/:blockId/flats`
Get flats in block.

```bash
curl -X GET http://localhost:3000/api/v1/resident/onboarding/societies/clx_society_id/blocks/clx_block_id/flats \
  -H "Authorization: Bearer <onboarding_token>"
```

#### POST `/resident/onboarding/request`
Submit onboarding request.

```bash
curl -X POST http://localhost:3000/api/v1/resident/onboarding/request \
  -H "Authorization: Bearer <onboarding_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "societyId": "clx_society_id",
    "blockId": "clx_block_id",
    "flatId": "clx_flat_id",
    "residentType": "OWNER",
    "documents": ["documents/aadhar.pdf", "documents/ownership.pdf"]
  }'
```

**Resident Types:** `OWNER`, `TENANT`

#### GET `/resident/onboarding/status`
Get onboarding status.

```bash
curl -X GET http://localhost:3000/api/v1/resident/onboarding/status \
  -H "Authorization: Bearer <onboarding_token>"
```

#### GET `/resident/onboarding/admin/pending`
Get pending onboarding requests (Admin only).

```bash
curl -X GET http://localhost:3000/api/v1/resident/onboarding/admin/pending \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/resident/onboarding/admin/:requestId`
Get onboarding request details (Admin only).

```bash
curl -X GET http://localhost:3000/api/v1/resident/onboarding/admin/clx_request_id \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/resident/onboarding/admin/:requestId/approve`
Approve onboarding (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/onboarding/admin/clx_request_id/approve \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/resident/onboarding/admin/:requestId/reject`
Reject onboarding (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/onboarding/admin/clx_request_id/reject \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/resident/onboarding/admin/:requestId/request-resubmit`
Request document resubmission (Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/onboarding/admin/clx_request_id/request-resubmit \
  -H "Authorization: Bearer <admin_access_token>"
```

### 6.2 Notifications

#### GET `/resident/notifications`
Get notifications.

```bash
curl -X GET "http://localhost:3000/api/v1/resident/notifications?page=1&limit=20&unreadOnly=true" \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/resident/notifications/unread-count`
Get unread count.

```bash
curl -X GET http://localhost:3000/api/v1/resident/notifications/unread-count \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/resident/notifications/read-all`
Mark all as read.

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/notifications/read-all \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/resident/notifications/:id/read`
Mark single notification as read.

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/notifications/clx_notification_id/read \
  -H "Authorization: Bearer <access_token>"
```

### 6.3 Family

#### GET `/resident/family`
Get family members.

```bash
curl -X GET http://localhost:3000/api/v1/resident/family \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/resident/family/invite`
Invite family member.

```bash
curl -X POST http://localhost:3000/api/v1/resident/family/invite \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543219",
    "name": "Spouse Name",
    "email": "spouse@example.com",
    "familyRole": "CO_RESIDENT"
  }'
```

**Family Roles:** `CO_RESIDENT`, `DEPENDENT`, `GUEST`

#### DELETE `/resident/family/:memberId`
Remove family member.

```bash
curl -X DELETE http://localhost:3000/api/v1/resident/family/clx_member_id \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/resident/family/:memberId/role`
Update family role.

```bash
curl -X PATCH http://localhost:3000/api/v1/resident/family/clx_member_id/role \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "familyRole": "DEPENDENT"
  }'
```

---

## 7. Deliveries

#### POST `/deliveries/expected`
Add expected delivery.

```bash
curl -X POST http://localhost:3000/api/v1/deliveries/expected \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Amazon",
    "trackingNumber": "AMZ123456789",
    "expectedDate": "2024-01-18",
    "description": "Electronics order"
  }'
```

#### GET `/deliveries/expected`
Get expected deliveries.

```bash
curl -X GET http://localhost:3000/api/v1/deliveries/expected \
  -H "Authorization: Bearer <access_token>"
```

#### POST `/deliveries/auto-approve`
Create auto-approve rule.

```bash
curl -X POST http://localhost:3000/api/v1/deliveries/auto-approve \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Amazon",
    "isActive": true
  }'
```

#### GET `/deliveries/auto-approve`
Get auto-approve rules.

```bash
curl -X GET http://localhost:3000/api/v1/deliveries/auto-approve \
  -H "Authorization: Bearer <access_token>"
```

#### PATCH `/deliveries/auto-approve/:id`
Toggle auto-approve rule.

```bash
curl -X PATCH http://localhost:3000/api/v1/deliveries/auto-approve/clx_rule_id \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

#### DELETE `/deliveries/auto-approve/:id`
Delete auto-approve rule.

```bash
curl -X DELETE http://localhost:3000/api/v1/deliveries/auto-approve/clx_rule_id \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/deliveries/companies`
Get popular delivery companies.

```bash
curl -X GET http://localhost:3000/api/v1/deliveries/companies \
  -H "Authorization: Bearer <access_token>"
```

---

## 8. Upload

#### POST `/upload/presigned-url`
Get pre-signed URL for upload.

```bash
curl -X POST http://localhost:3000/api/v1/upload/presigned-url \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "context": "COMPLAINT",
    "fileName": "leak_photo.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 1048576
  }'
```

**Context options:** `COMPLAINT`, `ENTRY_REQUEST`, `ONBOARDING`, `DOCUMENT`

**Response:**
```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/...",
  "key": "complaints/uuid/leak_photo.jpg",
  "expiresIn": 3600
}
```

#### POST `/upload/confirm`
Confirm upload completion.

```bash
curl -X POST http://localhost:3000/api/v1/upload/confirm \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "complaints/uuid/leak_photo.jpg",
    "fileName": "leak_photo.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 1048576,
    "documentType": "PHOTO"
  }'
```

#### GET `/upload/:id/view-url`
Get view URL for document.

```bash
curl -X GET http://localhost:3000/api/v1/upload/clx_document_id/view-url \
  -H "Authorization: Bearer <access_token>"
```

#### DELETE `/upload/:id`
Delete uploaded document.

```bash
curl -X DELETE http://localhost:3000/api/v1/upload/clx_document_id \
  -H "Authorization: Bearer <access_token>"
```

#### GET `/upload/entry-photo/:id`
Get entry request photo.

```bash
curl -X GET http://localhost:3000/api/v1/upload/entry-photo/clx_entry_request_id \
  -H "Authorization: Bearer <access_token>"
```

---

## 9. Admin Routes

### 9.1 Societies

#### POST `/admin/societies`
Create society (Super Admin only).

```bash
curl -X POST http://localhost:3000/api/v1/admin/societies \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Green Valley Apartments",
    "address": "123 Main Street, Sector 5",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "phone": "+912212345678",
    "email": "admin@greenvalley.com"
  }'
```

#### GET `/admin/societies`
Get all societies (Super Admin only).

```bash
curl -X GET http://localhost:3000/api/v1/admin/societies \
  -H "Authorization: Bearer <super_admin_token>"
```

#### GET `/admin/societies/:id`
Get society details.

```bash
curl -X GET http://localhost:3000/api/v1/admin/societies/clx_society_id \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/admin/societies/:id`
Update society.

```bash
curl -X PATCH http://localhost:3000/api/v1/admin/societies/clx_society_id \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+912212345679"
  }'
```

#### GET `/admin/societies/:id/stats`
Get society statistics.

```bash
curl -X GET http://localhost:3000/api/v1/admin/societies/clx_society_id/stats \
  -H "Authorization: Bearer <admin_access_token>"
```

#### PATCH `/admin/societies/:id/payment-paid`
Mark payment as paid (Super Admin only).

```bash
curl -X PATCH http://localhost:3000/api/v1/admin/societies/clx_society_id/payment-paid \
  -H "Authorization: Bearer <super_admin_token>"
```

### 9.2 Reports

#### GET `/admin/reports/dashboard`
Get dashboard statistics.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/reports/dashboard?societyId=clx_society_id" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/entries`
Get entry statistics.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/reports/entries?days=7" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/peak-hours`
Get peak hours analysis.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/reports/peak-hours?days=30" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/delivery-patterns`
Get delivery patterns.

```bash
curl -X GET "http://localhost:3000/api/v1/admin/reports/delivery-patterns?days=30" \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/complaints`
Get complaint statistics.

```bash
curl -X GET http://localhost:3000/api/v1/admin/reports/complaints \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/visitor-frequency`
Get visitor frequency report.

```bash
curl -X GET http://localhost:3000/api/v1/admin/reports/visitor-frequency \
  -H "Authorization: Bearer <admin_access_token>"
```

#### GET `/admin/reports/health-score`
Get society health score.

```bash
curl -X GET http://localhost:3000/api/v1/admin/reports/health-score \
  -H "Authorization: Bearer <admin_access_token>"
```

---

## 10. Guard App Routes

These routes are for the guard mobile application.

#### GET `/guard/today`
Get today's dashboard.

```bash
curl -X GET http://localhost:3000/api/v1/guard/today \
  -H "Authorization: Bearer <guard_access_token>"
```

#### GET `/guard/pending-count`
Get pending approvals count.

```bash
curl -X GET http://localhost:3000/api/v1/guard/pending-count \
  -H "Authorization: Bearer <guard_access_token>"
```

#### POST `/guard/entries`
Create entry.

```bash
curl -X POST http://localhost:3000/api/v1/guard/entries \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "flatId": "clx_flat_id",
    "type": "DELIVERY",
    "visitorName": "Delivery Person",
    "providerTag": "Flipkart"
  }'
```

#### PATCH `/guard/entries/:id/checkout`
Checkout entry.

```bash
curl -X PATCH http://localhost:3000/api/v1/guard/entries/clx_entry_id/checkout \
  -H "Authorization: Bearer <guard_access_token>"
```

#### GET `/guard/entries`
Get entries list.

```bash
curl -X GET http://localhost:3000/api/v1/guard/entries \
  -H "Authorization: Bearer <guard_access_token>"
```

#### POST `/guard/entry-requests`
Create entry request with notification.

```bash
curl -X POST http://localhost:3000/api/v1/guard/entry-requests \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "flatId": "clx_flat_id",
    "type": "VISITOR",
    "visitorName": "Guest Name",
    "visitorPhone": "+919876543220",
    "photoKey": "entry-photos/photo.jpg"
  }'
```

#### POST `/guard/scan/preapproval`
Scan pre-approval QR.

```bash
curl -X POST http://localhost:3000/api/v1/guard/scan/preapproval \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "pa_abc123xyz789"
  }'
```

#### POST `/guard/scan/gatepass`
Scan gate pass QR.

```bash
curl -X POST http://localhost:3000/api/v1/guard/scan/gatepass \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "gp_abc123xyz789"
  }'
```

#### POST `/guard/scan/staff`
Scan staff QR for attendance.

```bash
curl -X POST http://localhost:3000/api/v1/guard/scan/staff \
  -H "Authorization: Bearer <guard_access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "staff_abc123xyz789"
  }'
```

---

## Quick Reference - User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `RESIDENT` | Regular flat resident | Own flat data, create complaints, book amenities |
| `ADMIN` | Society administrator | Manage society, approve requests, manage users |
| `SUPER_ADMIN` | Platform administrator | Create societies, manage all societies |
| `GUARD` | Gate security guard | Create entries, scan QR codes, manage gate |

---

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid data |
| `401` | Unauthorized - Invalid/missing token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found |
| `409` | Conflict - Duplicate entry |
| `500` | Internal Server Error |

---

## Testing Tips

1. **Get tokens first**: Start by testing auth endpoints to get access tokens
2. **Use environment variables**: Store tokens in environment variables for easy reuse
3. **Test in order**: Create resources before testing update/delete
4. **Check permissions**: Test with different user roles to verify access control
5. **Validate responses**: Check response structure matches expected format

---

## Postman Collection Import

You can import this documentation into Postman by:
1. Creating a new collection
2. Adding requests based on the curl examples above
3. Setting up environment variables for `base_url` and `access_token`

---

*Generated for Society Gate Backend API v1*
