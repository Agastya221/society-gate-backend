# Society Gate Backend - API Documentation

**Version:** 2.0
**Base URL:** `http://your-domain.com/api/v1/auth` or `/api/auth`
**Authentication:** Bearer Token (JWT - Access & Refresh Tokens)

---

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Base URL & Headers](#base-url--headers)
3. [Public Endpoints](#public-endpoints)
4. [Token Management](#token-management)
5. [Protected Endpoints - Resident App](#protected-endpoints---resident-app)
6. [Protected Endpoints - Guard App](#protected-endpoints---guard-app)
7. [Error Handling](#error-handling)
8. [Redis Caching](#redis-caching)
9. [User Roles](#user-roles)

---

## Authentication Flow

### New Token System (v2.0)

The API now uses **Access Tokens** and **Refresh Tokens** for enhanced security:

- **Access Token**: Short-lived (15 minutes) - Used for API requests
- **Refresh Token**: Long-lived (7-30 days) - Used to get new access tokens

### Login/Registration Flow Options:

#### Option 1: OTP-Based (Phone Only)
```
1. POST /otp/send → Send OTP to phone
2. POST /otp/verify → Verify OTP + create/login user
3. Store accessToken and refreshToken
4. Use accessToken for authenticated requests
5. When accessToken expires, use refreshToken to get new accessToken
6. Use POST /logout to invalidate both tokens
```

#### Option 2: Password-Based
```
1. POST /resident-app/login (for residents/admins)
   OR
   POST /guard-app/login (for guards)
2. Store accessToken and refreshToken
3. Use accessToken for authenticated requests
4. When accessToken expires, use refreshToken to get new accessToken
5. Use POST /logout to invalidate both tokens
```

### Token Refresh Flow
```
1. API request fails with 401 (Token expired)
2. POST /refresh-token with refreshToken
3. Get new accessToken
4. Retry original request with new accessToken
```

---

## Base URL & Headers

### Base URL
```
Production: https://your-domain.com/api/v1/auth
Development: http://localhost:3000/api/v1/auth
```

### Common Headers

**For Public Endpoints:**
```json
{
  "Content-Type": "application/json"
}
```

**For Protected Endpoints:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

---

## Public Endpoints

### 1. Send OTP

**Endpoint:** `POST /otp/send`
**Description:** Request an OTP for phone verification (used for login/registration)
**Authentication:** Not required

#### Request Body
```json
{
  "phone": "+919876543210"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### Error Responses

**429 - Too Many Requests (Phone Limit)**
```json
{
  "success": false,
  "message": "Too many OTP requests for this phone number. Please try again after 1 hour."
}
```

**429 - Too Many Requests (IP Limit)**
```json
{
  "success": false,
  "message": "Too many OTP requests from this IP address. Please try again after 1 hour."
}
```

**400 - Invalid Phone**
```json
{
  "success": false,
  "message": "Invalid phone number format"
}
```

#### Rate Limits
- 3 OTP requests per phone number per hour
- 5 OTP requests per IP address per hour
- OTP validity: 2 minutes

---

### 2. Verify OTP

**Endpoint:** `POST /otp/verify`
**Description:** Verify OTP and create/login user
**Authentication:** Not required

#### Request Body
```json
{
  "phone": "+919876543210",
  "otp": "123456",
  "name": "John Doe",
  "email": "john@example.com"  // Optional
}
```

#### Success Response (200)

**New User Created:**
```json
{
  "success": true,
  "message": "Profile created successfully. Please complete onboarding.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "role": "RESIDENT",
      "isActive": false,
      "flatId": null,
      "societyId": null,
      "photoUrl": null,
      "lastLogin": null,
      "createdAt": "2026-01-22T12:00:00Z",
      "updatedAt": "2026-01-22T12:00:00Z"
    },
    "requiresOnboarding": true,
    "onboardingStatus": "DRAFT",
    "appType": "RESIDENT_APP"
  }
}
```

**Existing User Login:**
```json
{
  "success": true,
  "message": "Welcome back!",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "role": "RESIDENT",
      "isActive": true,
      "flatId": "uuid-here",
      "societyId": "uuid-here",
      "photoUrl": "https://example.com/photo.jpg",
      "lastLogin": "2026-01-22T11:00:00Z",
      "createdAt": "2026-01-21T12:00:00Z",
      "updatedAt": "2026-01-22T12:00:00Z"
    },
    "requiresOnboarding": false,
    "onboardingStatus": "NOT_STARTED",
    "appType": "RESIDENT_APP"
  }
}
```

#### Error Responses

**400 - Invalid OTP**
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

**400 - Missing Name**
```json
{
  "success": false,
  "message": "Name is required"
}
```

**400 - Invalid Email**
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

---

### 3. admin App Login

**Endpoint:** `POST /admin-app/login`
**Description:** Login for residents, admins, and super admins using password
**Authentication:** Not required

#### Request Body

**Using Phone:**
```json
{
  "phone": "+919876543210",
  "password": "your-password"
}
```

**Using Email:**
```json
{
  "email": "john@example.com",
  "password": "your-password"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Welcome back, John Doe!",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "role": "RESIDENT",
      "isActive": true,
      "flatId": "uuid-here",
      "societyId": "uuid-here",
      "photoUrl": "https://example.com/photo.jpg",
      "lastLogin": "2026-01-22T12:00:00Z",
      "flat": {
        "id": "uuid-here",
        "flatNumber": "A-101",
        "floor": "1",
        "wing": "A"
      },
      "society": {
        "id": "uuid-here",
        "name": "Green Valley Society",
        "address": "123 Main Street",
        "city": "Mumbai",
        "isActive": true
      }
    },
    "appType": "RESIDENT_APP"
  }
}
```

#### Error Responses

**401 - Invalid Credentials**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**403 - Access Denied (Wrong Role)**
```json
{
  "success": false,
  "message": "Access denied"
}
```

**400 - Missing Fields**
```json
{
  "success": false,
  "message": "Phone/Email and password are required"
}
```

---

### 4. Guard App Login

**Endpoint:** `POST /guard-app/login`
**Description:** Login for security guards using phone and password
**Authentication:** Not required

#### Request Body
```json
{
  "phone": "+919876543210",
  "password": "your-password"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Welcome back, Guard Name!",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "name": "Guard Name",
      "phone": "+919876543210",
      "role": "GUARD",
      "isActive": true,
      "societyId": "uuid-here",
      "photoUrl": "https://example.com/photo.jpg",
      "lastLogin": "2026-01-22T12:00:00Z",
      "society": {
        "id": "uuid-here",
        "name": "Green Valley Society",
        "address": "123 Main Street",
        "city": "Mumbai",
        "isActive": true
      }
    },
    "appType": "GUARD_APP"
  }
}
```

#### Error Responses

**401 - Invalid Credentials**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**403 - Not a Guard**
```json
{
  "success": false,
  "message": "This app is only for guards"
}
```

**403 - Account Inactive**
```json
{
  "success": false,
  "message": "Your account is inactive"
}
```

**403 - Society Inactive**
```json
{
  "success": false,
  "message": "Society is inactive. Contact admin."
}
```

---

## Token Management

### 5. Refresh Access Token

**Endpoint:** `POST /refresh-token`
**Description:** Get a new access token using a refresh token
**Authentication:** Not required (uses refresh token)

#### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Access token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-here",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "role": "RESIDENT",
      "isActive": true,
      "flatId": "uuid-here",
      "societyId": "uuid-here"
    }
  }
}
```

#### Error Responses

**400 - Missing Refresh Token**
```json
{
  "success": false,
  "message": "Refresh token is required"
}
```

**401 - Invalid Refresh Token**
```json
{
  "success": false,
  "message": "Invalid refresh token"
}
```

**401 - Expired Refresh Token**
```json
{
  "success": false,
  "message": "Refresh token expired. Please login again."
}
```

---

### 6. Logout

**Endpoint:** `POST /logout`
**Description:** Logout the user and invalidate tokens
**Authentication:** Required (Access Token in Authorization header)

#### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Optional
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### Error Responses

**400 - No Access Token**
```json
{
  "success": false,
  "message": "No access token provided"
}
```

---

## Protected Endpoints - Resident App

All these endpoints require a valid JWT access token in the Authorization header.

### 5. Get User Profile

**Endpoint:** `GET /resident-app/profile`
**Description:** Get the logged-in user's profile
**Authentication:** Required (Bearer Token)
**Allowed Roles:** RESIDENT, ADMIN, SUPER_ADMIN

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "role": "RESIDENT",
    "isActive": true,
    "flatId": "uuid-here",
    "societyId": "uuid-here",
    "photoUrl": "https://example.com/photo.jpg",
    "isOwner": true,
    "isPrimaryResident": true,
    "familyRole": null,
    "primaryResidentId": null,
    "flat": {
      "id": "uuid-here",
      "flatNumber": "A-101",
      "floor": "1",
      "wing": "A",
      "bhk": "2BHK",
      "isActive": true
    },
    "society": {
      "id": "uuid-here",
      "name": "Green Valley Society",
      "address": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "isActive": true
    },
    "createdAt": "2026-01-20T12:00:00Z",
    "updatedAt": "2026-01-22T12:00:00Z"
  }
}
```

#### Error Responses

**401 - No Token**
```json
{
  "success": false,
  "message": "No token provided"
}
```

**401 - Invalid Token**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**401 - Token Expired**
```json
{
  "success": false,
  "message": "Token expired"
}
```

**401 - User Not Found**
```json
{
  "success": false,
  "message": "User not found or inactive"
}
```

**403 - Society Inactive**
```json
{
  "success": false,
  "message": "Society is inactive. Contact admin."
}
```

---

### 6. Update User Profile

**Endpoint:** `PATCH /resident-app/profile`
**Description:** Update the logged-in user's profile
**Authentication:** Required (Bearer Token)
**Allowed Roles:** RESIDENT, ADMIN, SUPER_ADMIN

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Request Body
```json
{
  "name": "Jane Doe",                    // Optional
  "email": "jane@example.com",            // Optional
  "photoUrl": "https://example.com/new-photo.jpg"  // Optional
}
```

Note: You can send one or more fields. Only the fields you send will be updated.

#### Success Response (200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-here",
    "name": "Jane Doe",
    "phone": "+919876543210",
    "email": "jane@example.com",
    "role": "RESIDENT",
    "isActive": true,
    "flatId": "uuid-here",
    "societyId": "uuid-here",
    "photoUrl": "https://example.com/new-photo.jpg",
    "updatedAt": "2026-01-22T12:30:00Z"
  }
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**400 - Validation Error**
```json
{
  "success": false,
  "message": "Invalid email format"
}
```

---

### 7. Create Guard Account (Admin Only)

**Endpoint:** `POST /resident-app/create-guard`
**Description:** Admin creates a new guard account for their society
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ADMIN only

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Request Body
```json
{
  "name": "Security Guard Name",
  "phone": "+919876543210",
  "password": "secure-password-123",
  "photoUrl": "https://example.com/guard-photo.jpg"  // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Guard account created successfully",
  "data": {
    "id": "uuid-here",
    "name": "Security Guard Name",
    "phone": "+919876543210",
    "role": "GUARD",
    "societyId": "uuid-here",
    "isActive": true,
    "photoUrl": "https://example.com/guard-photo.jpg",
    "society": {
      "id": "uuid-here",
      "name": "Green Valley Society",
      "address": "123 Main Street",
      "city": "Mumbai"
    },
    "createdAt": "2026-01-22T12:00:00Z",
    "updatedAt": "2026-01-22T12:00:00Z"
  }
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**403 - Not an Admin**
```json
{
  "success": false,
  "message": "Only admin can create guard accounts"
}
```

**400 - Phone Already Registered**
```json
{
  "success": false,
  "message": "Phone number already registered"
}
```

**400 - Missing Required Fields**
```json
{
  "success": false,
  "message": "Name, phone, and password are required"
}
```

---

### 8. Get All Guards (Admin Only)

**Endpoint:** `GET /resident-app/guards`
**Description:** Get all guards in the admin's society
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ADMIN only

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "name": "Guard 1",
      "phone": "+919876543210",
      "photoUrl": "https://example.com/photo1.jpg",
      "isActive": true,
      "lastLogin": "2026-01-22T10:00:00Z",
      "createdAt": "2026-01-20T12:00:00Z"
    },
    {
      "id": "uuid-here-2",
      "name": "Guard 2",
      "phone": "+919876543211",
      "photoUrl": "https://example.com/photo2.jpg",
      "isActive": true,
      "lastLogin": "2026-01-22T08:00:00Z",
      "createdAt": "2026-01-19T12:00:00Z"
    }
  ]
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**403 - Access Denied**
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

### 9. Toggle User Status (Admin Only)

**Endpoint:** `PATCH /resident-app/users/:id/status`
**Description:** Activate or deactivate a user (for admins)
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ADMIN only

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Request Body
```json
{
  "isActive": true  // or false to deactivate
}
```

#### Success Response (200)

**Activating User:**
```json
{
  "success": true,
  "message": "User activated",
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "isActive": true
  }
}
```

**Deactivating User:**
```json
{
  "success": true,
  "message": "User deactivated",
  "data": {
    "id": "uuid-here",
    "name": "John Doe",
    "isActive": false
  }
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**403 - Access Denied**
```json
{
  "success": false,
  "message": "Access denied"
}
```

**404 - User Not Found**
```json
{
  "success": false,
  "message": "User not found"
}
```

---

## Protected Endpoints - Guard App

### 10. Get Guard Profile

**Endpoint:** `GET /guard-app/profile`
**Description:** Get the logged-in guard's profile
**Authentication:** Required (Bearer Token)
**Allowed Roles:** GUARD only

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Guard Name",
    "phone": "+919876543210",
    "role": "GUARD",
    "isActive": true,
    "societyId": "uuid-here",
    "photoUrl": "https://example.com/photo.jpg",
    "lastLogin": "2026-01-22T12:00:00Z",
    "society": {
      "id": "uuid-here",
      "name": "Green Valley Society",
      "address": "123 Main Street",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "isActive": true
    },
    "createdAt": "2026-01-20T12:00:00Z",
    "updatedAt": "2026-01-22T12:00:00Z"
  }
}
```

#### Error Responses

**401 - Unauthorized**
```json
{
  "success": false,
  "message": "Invalid token"
}
```

**403 - Not a Guard**
```json
{
  "success": false,
  "message": "Access denied"
}
```

---

---

## Gate Management - Protected Endpoints

### 11. Create Entry (Guard Only)

**Endpoint:** `POST /gate/entries`
**Description:** Guard creates a new entry record for a visitor
**Authentication:** Required (Bearer Token)
**Allowed Roles:** GUARD

#### Request Body
```json
{
  "visitorName": "Rahul Kumar",
  "visitorPhone": "+919876543210",
  "visitorType": "GUEST",  // GUEST, DELIVERY, CAB, SERVICE
  "flatId": "uuid-of-flat",
  "vehicleNumber": "KA01AB1234",  // Optional
  "purpose": "Dinner invitation",  // Optional
  "accompaniedBy": 2,              // Number of extra people (Optional, default 0)
  "photoUrl": "https://example.com/visitor-photo.jpg" // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Entry created successfully",
  "data": {
    "id": "uuid-entry-here",
    "visitorName": "Rahul Kumar",
    "visitorPhone": "+919876543210",
    "visitorType": "GUEST",
    "status": "WAITING_APPROVAL",
    "checkInTime": null,
    "checkOutTime": null,
    "gateId": "uuid-gate-here",
    "flatId": "uuid-flat-here",
    "societyId": "uuid-society-here",
    "createdAt": "2026-01-23T10:00:00Z"
  }
}
```

#### Error Responses

**404 - Flat Not Found**
```json
{
  "success": false,
  "message": "Flat not found"
}
```

---

### 12. Approve/Reject Entry (Resident Only)

**Endpoint:** `PATCH /gate/entries/:id/approve`
**Description:** Resident approves a visitor entry
**Authentication:** Required (Bearer Token)
**Allowed Roles:** RESIDENT, ADMIN

#### Request Headers
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Entry approved",
  "data": {
    "id": "uuid-entry-here",
    "status": "APPROVED",
    "approvalTime": "2026-01-23T10:05:00Z",
    "approvedBy": "uuid-resident-id"
  }
}
```

**Note:** For rejection, use `/gate/entries/:id/reject`. structure is identical, status will be "DENIED".

---

### 13. Get Entries (History)

**Endpoint:** `GET /gate/entries`
**Description:** Get entry history with filters
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ALL

#### Query Parameters
- `page`: Page number (default 1)
- `limit`: Items per page (default 10)
- `type`: Filter by visitor type (GUEST, DELIVERY, etc.)
- `status`: Filter by status (APPROVED, DENIED, EXIT, etc.)

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "uuid-entry-1",
        "visitorName": "Rahul Kumar",
        "visitorType": "GUEST",
        "status": "EXIT",
        "checkInTime": "2026-01-23T10:10:00Z",
        "checkOutTime": "2026-01-23T14:30:00Z",
        "flat": {
          "flatNumber": "A-101"
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "pages": 5
    }
  }
}
```

---

### 14. Create Pre-Approval

**Endpoint:** `POST /gate/preapprovals`
**Description:** Resident pre-approves a guest or delivery
**Authentication:** Required (Bearer Token)
**Allowed Roles:** RESIDENT

#### Request Body
```json
{
  "visitorName": "Mom & Dad",
  "visitorPhone": "+919988776655",  // Optional
  "visitorType": "GUEST",
  "expectedArrival": "2026-01-25T18:00:00Z",
  "vehicleNumber": "TN05XY1234"      // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Pre-approval created",
  "data": {
    "id": "uuid-preapproval-here",
    "code": "123456",
    "qrCodeUrl": "https://api.qrserver.com/...",
    "visitorName": "Mom & Dad",
    "expiresAt": "2026-01-25T23:59:59Z"
  }
}
```

---

## Community Management

### 15. Get Notices

**Endpoint:** `GET /community/notices`
**Description:** Get society notices
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ALL

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-notice-1",
      "title": "Diwali Celebration",
      "content": "Join us for the Diwali party at the clubhouse.",
      "type": "EVENT",
      "isPinned": true,
      "createdAt": "2026-01-20T10:00:00Z",
      "expiresAt": "2026-11-01T00:00:00Z"
    },
    {
      "id": "uuid-notice-2",
      "title": "Water Tank Cleaning",
      "content": "Water supply will be disrupted on Sunday.",
      "type": "MAINTENANCE",
      "isPinned": false,
      "createdAt": "2026-01-22T09:00:00Z"
    }
  ]
}
```

---

### 16. Create Notice (Admin Only)

**Endpoint:** `POST /community/notices`
**Description:** Publish a new notice
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ADMIN

#### Request Body
```json
{
  "title": "Lift Maintenance",
  "content": "Lift A will be under maintenance from 2 PM to 4 PM.",
  "type": "MAINTENANCE",  // GENERAL, ALERT, EVENT, MAINTENANCE
  "expiresAt": "2026-01-24T16:00:00Z", // Optional
  "isPinned": true        // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Notice created successfully",
  "data": {
    "id": "uuid-notice-new",
    "title": "Lift Maintenance",
    "type": "MAINTENANCE"
  }
}
```

---

### 17. Create Complaint

**Endpoint:** `POST /community/complaints`
**Description:** Resident raises a complaint
**Authentication:** Required (Bearer Token)
**Allowed Roles:** RESIDENT, ADMIN

#### Request Body
```json
{
  "title": "Leaking Pipe in Parking",
  "description": "There is a water leakage near pillar 14 in basement parking.",
  "category": "PLUMBING", // PLUMBING, ELECTRICAL, SECURITY, CLEANLINESS, OTHER
  "urgency": "MEDIUM",    // LOW, MEDIUM, HIGH, CRITICAL
  "isPrivate": false,     // If true, only admins can see
  "photos": ["https://example.com/leak.jpg"] // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Complaint raised successfully",
  "data": {
    "id": "uuid-complaint-here",
    "status": "OPEN",
    "ticketNumber": "CMP-12345",
    "createdAt": "2026-01-23T11:00:00Z"
  }
}
```

---

## Staff Management

### 18. Get Domestic Staff List

**Endpoint:** `GET /staff/domestic`
**Description:** Get list of domestic staff working in the society
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ALL

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-staff-1",
      "name": "Sunita Devi",
      "role": "MAID",
      "phone": "+919876500001",
      "photoUrl": "https://example.com/staff1.jpg",
      "isVerified": true,
      "overallRating": 4.5,
      "status": "INSIDE", // INSIDE, OUTSIDE
      "lastCheckIn": "2026-01-23T08:30:00Z"
    }
  ]
}
```

---

### 19. Staff Check-In/Scan (Guard & Resident)

**Endpoint:** `POST /staff/domestic/check-in`
**Description:** Record staff entry via ID or QR scan
**Authentication:** Required (Bearer Token)
**Allowed Roles:** GUARD, RESIDENT

#### Request Body
```json
{
  "staffId": "uuid-staff-1",
  "gateId": "uuid-gate-1"     // Optional if pure resident scan
}
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Check-in successful",
  "data": {
    "attendanceId": "uuid-attendance-1",
    "staffName": "Sunita Devi",
    "checkInTime": "2026-01-23T09:00:00Z",
    "status": "PRESENT"
  }
}
```

---

## Emergency Management

### 20. Raise Emergency Alert

**Endpoint:** `POST /community/emergencies`
**Description:** Trigger an SOS alert to guards and admins
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ALL

#### Request Body
```json
{
  "type": "MEDICAL", // MEDICAL, FIRE, SECURITY, LIFT_STUCK, ANIMAL_THREAT, OTHER
  "description": "My father is having chest pain",
  "latitude": 12.9716,  // Optional geolocation
  "longitude": 77.5946
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "EMERGENCY ALERT SENT!",
  "data": {
    "id": "uuid-emergency-here",
    "type": "MEDICAL",
    "status": "TRIGGERED",
    "sender": {
      "name": "Amit Verma",
      "flat": "A-101",
      "phone": "+919845123456"
    },
    "createdAt": "2026-01-23T12:00:00Z"
  }
}
```

---

## Resident Services

### 21. Get User Notifications

**Endpoint:** `GET /resident/notifications`
**Description:** Get list of notifications for the user
**Authentication:** Required (Bearer Token)
**Allowed Roles:** ALL

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-notif-1",
      "title": "Visitor Arrived",
      "body": "Rahul Kumar is at the gate.",
      "type": "ENTRY_REQUEST",
      "isRead": false,
      "data": { "entryId": "uuid-entry-1" },
      "createdAt": "2026-01-23T10:00:00Z"
    }
  ]
}
```

### 22. Get/Manage Entry Requests

**Endpoint:** `GET /gate/requests`
**Description:** Get entry requests (mostly for Residents to approve)
**Authentication:** Required
**Allowed Roles:** ALL

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-request-1",
      "visitorName": "Service Provider",
      "visitorType": "SERVICE",
      "status": "PENDING",
      "photoUrl": "https://example.com/photo.jpg",
      "createdAt": "2026-01-23T10:30:00Z"
    }
  ]
}
```

**Approve/Reject:**
`PATCH /gate/requests/:id/approve` or `reject`

---

### 23. Create Gate Pass

**Endpoint:** `POST /gate/passes`
**Description:** Create a gate pass for material movement or staff
**Authentication:** Required
**Allowed Roles:** RESIDENT, ADMIN

#### Request Body
```json
{
  "type": "MATERIAL_OUT", // MATERIAL_IN, MATERIAL_OUT, STAFF
  "description": "Moving out old sofa",
  "validFrom": "2026-01-24T10:00:00Z",
  "validTo": "2026-01-24T18:00:00Z",
  "contractorName": "Movers Ltd" // Optional
}
```

#### Success Response (201)
```json
{
  "success": true,
  "data": {
    "id": "uuid-pass-1",
    "code": "GP-9876",
    "status": "APPROVED", // Auto-approved for residents usually
    "qrCodeUrl": "..."
  }
}
```

---

### 24. Amenities & Bookings

**Get Amenities:** `GET /community/amenities`

**Book Amenity:**
`POST /community/bookings`

#### Request Body (Booking)
```json
{
  "amenityId": "uuid-amenity-1",
  "startTime": "2026-01-25T10:00:00Z",
  "endTime": "2026-01-25T11:00:00Z"
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Booking request submitted",
  "data": {
    "id": "uuid-booking-1",
    "status": "CONFIRMED",
    "amount": 0
  }
}
```

---

### 25. Family Management

**Endpoint:** `POST /resident/family/invite`
**Description:** Primary resident invites a family member to the app
**Authentication:** Required (Primary Resident)

#### Request Body
```json
{
  "name": "Priya Verma",
  "phone": "+919876543211",
  "role": "SPOUSE" // SPOUSE, CHILD, PARENT, OTHER
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Invitation sent successfully"
}
```

---

### 26. Admin Reports (Dashboard)

**Endpoint:** `GET /admin/reports/dashboard`
**Description:** Get high-level society statistics
**Authentication:** Required
**Allowed Roles:** ADMIN

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "totalFlats": 144,
    "occupiedFlats": 120,
    "activeResidents": 350,
    "todayEntries": 45,
    "pendingComplaints": 3
  }
}
```

---

### 27. File Uploads

**Endpoint:** `POST /upload/presigned-url`
**Description:** Get a secure URL to upload files (S3/Cloudinary)
**Authentication:** Required

#### Request Body
```json
{
  "fileName": "profile.jpg",
  "fileType": "image/jpeg",
  "folder": "profiles" // profiles, documents, complaints
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/key?signature...",
    "fileId": "uuid-file-1",
    "key": "profiles/uuid-file-1.jpg"
  }
}
```

**Confirm Upload:**
After uploading to the URL, call `POST /upload/confirm` with `{ "fileId": "..." }`.

---

### 28. Service Delivery Rules

**Endpoint:** `POST /deliveries/auto-approve`
**Description:** Set automatic approval for specific courier companies
**Authentication:** Required
**Allowed Roles:** RESIDENT

#### Request Body
```json
{
  "companyName": "Amazon",
  "isActive": true
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Auto-approve rule created"
}
```

---

## Error Handling

### Standard Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "message": "Error description here"
}
```

### HTTP Status Codes

| Status Code | Meaning | Usage |
|-------------|---------|-------|
| 200 | OK | Successful GET, PATCH requests |
| 201 | Created | Successful POST requests (resource created) |
| 400 | Bad Request | Validation errors, missing required fields |
| 401 | Unauthorized | Missing/invalid/expired token, authentication failed |
| 403 | Forbidden | User doesn't have permission to access resource |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limiting exceeded |
| 500 | Internal Server Error | Server-side error |

### Common Error Scenarios

#### Authentication Errors (401)
```json
{
  "success": false,
  "message": "No token provided"
}
```
```json
{
  "success": false,
  "message": "Invalid token"
}
```
```json
{
  "success": false,
  "message": "Token expired"
}
```

#### Authorization Errors (403)
```json
{
  "success": false,
  "message": "Access denied"
}
```
```json
{
  "success": false,
  "message": "Only admin can create guard accounts"
}
```

#### Validation Errors (400)
```json
{
  "success": false,
  "message": "Invalid email format"
}
```
```json
{
  "success": false,
  "message": "Phone number already registered"
}
```

#### Rate Limiting (429)
```json
{
  "success": false,
  "message": "Too many OTP requests. Please try again after 1 hour."
}
```

---

## Token Management

### JWT Token Structure

The JWT token contains these claims:

```json
{
  "userId": "uuid-here",
  "role": "RESIDENT",
  "societyId": "uuid-here",
  "flatId": "uuid-here",
  "appType": "RESIDENT_APP",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Token Expiry

- **Resident App:** 30 days
- **Guard App:** 7 days

### Using Tokens

Include the token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Storage (Frontend Recommendations)

For web apps:
- Store token in `localStorage` or `sessionStorage`
- For better security, consider `httpOnly` cookies if implementing refresh tokens

For mobile apps:
- Store token in secure storage (iOS Keychain, Android Keystore)

### Handling Token Expiry

When you receive a 401 error with message "Token expired":
1. Clear stored token
2. Redirect user to login screen
3. User must login again to get a new token

### Logout Implementation

There is no specific logout endpoint. To logout:
1. Remove the stored JWT token from client storage
2. Clear any user data from app state
3. Redirect to login screen

The token will eventually expire on the server (30 days for residents, 7 days for guards).

---

## User Roles

### Available Roles

| Role | Description | App Access | Key Permissions |
|------|-------------|------------|-----------------|
| SUPER_ADMIN | Platform administrator | Resident App | Full access to all societies and features |
| ADMIN | Society secretary/admin | Resident App | Manage guards, approve residents, society settings |
| RESIDENT | Flat owner or tenant | Resident App | View profile, manage family, request services |
| GUARD | Security guard | Guard App | View visitor logs, approve entries |

### Role-Based Access Control

**Resident App:**
- RESIDENT: Can access own profile, family members
- ADMIN: Can access resident features + create guards, manage users
- SUPER_ADMIN: Full access across all societies

**Guard App:**
- GUARD: Can only use guard app features
- Other roles: Cannot access guard app

---

## Quick Reference

### Authentication Workflow Examples

#### Example 1: New User Registration via OTP

```javascript
// Step 1: Send OTP
const sendOtpResponse = await fetch('https://your-api.com/api/v1/auth/otp/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+919876543210' })
});

// Step 2: Verify OTP
const verifyResponse = await fetch('https://your-api.com/api/v1/auth/otp/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+919876543210',
    otp: '123456',
    name: 'John Doe',
    email: 'john@example.com'
  })
});

const data = await verifyResponse.json();
const token = data.data.token;

// Step 3: Store token
localStorage.setItem('authToken', token);
```

#### Example 2: Existing User Login with Password

```javascript
const loginResponse = await fetch('https://your-api.com/api/v1/auth/resident-app/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+919876543210',
    password: 'your-password'
  })
});

const data = await loginResponse.json();
const token = data.data.token;

// Store token
localStorage.setItem('authToken', token);
```

#### Example 3: Fetch User Profile

```javascript
const token = localStorage.getItem('authToken');

const profileResponse = await fetch('https://your-api.com/api/v1/auth/resident-app/profile', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
});

const data = await profileResponse.json();
const user = data.data;
```

#### Example 4: Update Profile

```javascript
const token = localStorage.getItem('authToken');

const updateResponse = await fetch('https://your-api.com/api/v1/auth/resident-app/profile', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Jane Doe',
    email: 'jane@example.com'
  })
});

const data = await updateResponse.json();
```

#### Example 5: Logout

```javascript
const accessToken = localStorage.getItem('accessToken');
const refreshToken = localStorage.getItem('refreshToken');

await fetch('https://your-api.com/api/v1/auth/logout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    refreshToken: refreshToken
  })
});

// Remove tokens from storage
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');

// Redirect to login
window.location.href = '/login';
```

#### Example 6: Refresh Access Token

```javascript
const refreshToken = localStorage.getItem('refreshToken');

try {
  const response = await fetch('https://your-api.com/api/v1/auth/refresh-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refreshToken: refreshToken
    })
  });

  const data = await response.json();

  if (data.success) {
    // Store new access token
    localStorage.setItem('accessToken', data.data.accessToken);

    // Retry the original request with new token
    // ...
  } else {
    // Refresh token is invalid/expired, redirect to login
    window.location.href = '/login';
  }
} catch (error) {
  // Handle error
  window.location.href = '/login';
}
```

---

## Redis Caching

The API uses Redis for caching to improve performance and reduce database load.

### Cached Endpoints

The following endpoints are cached:

1. **Notifications**
   - `GET /api/v1/resident/notifications` - Cached for 1 minute (varies by user)
   - `GET /api/v1/resident/notifications/unread-count` - Cached for 30 seconds (varies by user)

2. **Society Data**
   - `GET /api/v1/admin/societies` - Cached for 2 minutes
   - `GET /api/v1/admin/societies/:id` - Cached for 5 minutes (varies by society)
   - `GET /api/v1/admin/societies/:id/stats` - Cached for 3 minutes (varies by society)

### Cache Invalidation

Cache is automatically cleared when:
- Notifications are marked as read (clears all notification cache)
- Society data is updated (clears all society cache)
- User creates/updates resources

### Benefits

- **Faster Response Times**: Cached responses are served in milliseconds
- **Reduced Database Load**: Frequently accessed data doesn't hit the database
- **Better Scalability**: API can handle more requests with same resources

### Notes for Developers

- Cached data may be up to the TTL (Time To Live) old
- For real-time critical features, cache is kept short (30-60 seconds)
- Mutations automatically clear related cache

---

## Support & Contact

For API issues or questions, contact:
- Backend Developer: [Your Email]
- Documentation: This file
- Issue Tracker: [Your Repository URL]

---

**Last Updated:** 2026-01-23
**API Version:** 2.0
