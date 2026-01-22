# Society Gate Backend - API Documentation

**Version:** 1.0
**Base URL:** `http://your-domain.com/api/v1/auth` or `/api/auth`
**Authentication:** Bearer Token (JWT)

---

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Base URL & Headers](#base-url--headers)
3. [Public Endpoints](#public-endpoints)
4. [Protected Endpoints - Resident App](#protected-endpoints---resident-app)
5. [Protected Endpoints - Guard App](#protected-endpoints---guard-app)
6. [Error Handling](#error-handling)
7. [Token Management](#token-management)
8. [User Roles](#user-roles)

---

## Authentication Flow

### Login/Registration Flow Options:

#### Option 1: OTP-Based (Phone Only)
```
1. POST /otp/send → Send OTP to phone
2. POST /otp/verify → Verify OTP + create/login user
3. Store JWT token
4. Use token for authenticated requests
```

#### Option 2: Password-Based
```
1. POST /resident-app/login (for residents/admins)
   OR
   POST /guard-app/login (for guards)
2. Store JWT token
3. Use token for authenticated requests
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

## Protected Endpoints - Resident App

All these endpoints require a valid JWT token in the Authorization header.

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
// Simply remove the token
localStorage.removeItem('authToken');

// Redirect to login
window.location.href = '/login';
```

---

## Support & Contact

For API issues or questions, contact:
- Backend Developer: [Your Email]
- Documentation: This file
- Issue Tracker: [Your Repository URL]

---

**Last Updated:** 2026-01-22
**API Version:** 1.0
