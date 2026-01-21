# React Native Frontend Development Guide - Society Gate App

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Real-time Features (Socket.IO)](#real-time-features-socketio)
6. [File Upload Flow](#file-upload-flow)
7. [App Flows & User Journeys](#app-flows--user-journeys)
8. [Data Models](#data-models)
9. [UI/UX Requirements](#uiux-requirements)
10. [Implementation Checklist](#implementation-checklist)

---

## Project Overview

**Society Gate** is a MyGate-like society/apartment management system with **TWO mobile apps**:

### 1. Resident App
For society residents to:
- Register and onboard into society
- Manage family members (max 6 per flat)
- Get visitor entry notifications
- Pre-approve visitors
- Book amenities
- File complaints with photos
- Raise emergency alerts
- Manage domestic staff

### 2. Guard App
For security guards to:
- Scan QR codes for staff entry/exit
- Create entry requests with photos
- Approve/reject visitors
- View today's entries
- Handle deliveries

### Backend Details
- **Base URL**: `https://api.yourapp.com`
- **API Version**: `/api/v1` (new optimized routes)
- **Legacy Routes**: `/api` (still supported)
- **Authentication**: JWT Bearer tokens
- **Real-time**: Socket.IO for notifications

---

## System Architecture

### Multi-tenancy Structure
```
Society (Building/Apartment Complex)
  ├── Blocks (Tower A, Tower B, etc.)
  │   └── Flats (A101, A102, B201, etc.)
  │       └── Residents (Primary + Family Members, max 6)
  └── Staff
      ├── Guards
      ├── Admin
      └── Domestic Staff (Maids, Drivers, etc.)
```

### User Roles
```typescript
enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',  // Platform admin (manages all societies)
  ADMIN = 'ADMIN',              // Society admin
  GUARD = 'GUARD',              // Security guard
  RESIDENT = 'RESIDENT'         // Flat resident
}
```

### Family Member System
- **Primary Resident**: First approved resident for a flat (set automatically)
- **Family Members**: Up to 5 additional members (total 6 per flat)
- **Family Roles**: SPOUSE, CHILD, PARENT, SIBLING, OTHER
- **Permissions**: Only primary resident can invite/manage family members

---

## Authentication & Authorization

### Flow 1: Resident Registration (OTP-based)

```
1. User enters phone number
   POST /api/v1/auth/otp/send
   { "phone": "+919876543210" }

2. OTP sent to phone (via SMS)
   Response: { "success": true, "message": "OTP sent" }

3. User enters OTP + name + email
   POST /api/v1/auth/otp/verify
   {
     "phone": "+919876543210",
     "otp": "123456",
     "name": "John Doe",
     "email": "john@example.com"
   }

   Response: {
     "token": "eyJhbGc...",
     "user": { id, name, phone, role: "RESIDENT", isActive: false },
     "requiresOnboarding": true,
     "onboardingStatus": "DRAFT",
     "appType": "RESIDENT_APP"
   }

4. Token stored → User marked inactive (needs onboarding)

5. User completes onboarding (selects society, block, flat)
   - Submits onboarding request
   - Admin approves
   - User becomes active + primary resident

6. Primary resident can now invite family members
```

### Flow 2: Resident Login

```
POST /api/v1/auth/resident/login
{
  "phone": "+919876543210",
  "password": "securepassword"
}

Response: {
  "token": "eyJhbGc...",
  "user": {
    id, name, phone, email, role,
    flatId, societyId,
    isPrimaryResident, familyRole,
    isActive
  },
  "appType": "RESIDENT_APP"
}
```

### Flow 3: Guard Login

```
POST /api/v1/auth/guard/login
{
  "phone": "+919123456789",
  "password": "guardpassword"
}

Response: {
  "token": "eyJhbGc...",
  "user": { id, name, phone, role: "GUARD", societyId },
  "appType": "GUARD_APP"
}
```

### Flow 4: Family Member Invitation

```
1. Primary resident invites family member
   POST /api/v1/resident/family/invite
   Headers: { Authorization: "Bearer <token>" }
   {
     "phone": "+919999999999",
     "name": "Jane Doe",
     "email": "jane@example.com",
     "familyRole": "SPOUSE"
   }

   Response: {
     success: true,
     message: "Invited. They need to verify OTP to activate."
   }

2. Family member receives SMS with OTP

3. Family member verifies OTP (same as Flow 1 step 3)
   POST /api/v1/auth/otp/verify

   Backend detects: user.primaryResidentId exists
   → Auto-activates account
   → User can immediately access app

4. Family member logs in normally
```

### Token Storage & Usage

```typescript
// Store token after login
await AsyncStorage.setItem('authToken', response.token);
await AsyncStorage.setItem('user', JSON.stringify(response.user));

// Use token in all API requests
const token = await AsyncStorage.getItem('authToken');
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

### Token Expiry Handling

```typescript
// Interceptor for 401 errors
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.clear();
      navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);
```

---

## API Endpoints Reference

### Authentication Endpoints

#### 1. Send OTP
```
POST /api/v1/auth/otp/send
Body: { phone: string }
Response: { success: boolean, message: string }
```

#### 2. Verify OTP & Create Profile
```
POST /api/v1/auth/otp/verify
Body: {
  phone: string,
  otp: string,
  name: string,
  email?: string
}
Response: {
  token: string,
  user: User,
  requiresOnboarding: boolean,
  onboardingStatus: string,
  appType: string
}
```

#### 3. Resident Login
```
POST /api/v1/auth/resident/login
Body: { phone: string, password: string }
Response: { token: string, user: User, appType: string }
```

#### 4. Guard Login
```
POST /api/v1/auth/guard/login
Body: { phone: string, password: string }
Response: { token: string, user: User, appType: string }
```

#### 5. Get Profile
```
GET /api/v1/auth/profile
Headers: { Authorization: Bearer <token> }
Response: { success: true, data: User }
```

#### 6. Update Profile
```
PATCH /api/v1/auth/profile
Headers: { Authorization: Bearer <token> }
Body: { name?: string, email?: string, photoUrl?: string }
Response: { success: true, data: User }
```

---

### Onboarding Endpoints (Resident App)

#### 1. List Available Societies
```
GET /api/v1/resident/onboarding/societies
Headers: { Authorization: Bearer <token> }
Response: {
  success: true,
  data: Array<{
    id: string,
    name: string,
    address: string,
    city: string
  }>
}
```

#### 2. List Blocks in Society
```
GET /api/v1/resident/onboarding/societies/:societyId/blocks
Response: {
  success: true,
  data: Array<{ id: string, name: string }>
}
```

#### 3. List Flats in Block
```
GET /api/v1/resident/onboarding/societies/:societyId/blocks/:blockId/flats
Response: {
  success: true,
  data: Array<{
    id: string,
    flatNumber: string,
    isOccupied: boolean
  }>
}
```

#### 4. Submit Onboarding Request
```
POST /api/v1/resident/onboarding/request
Body: {
  societyId: string,
  blockId: string,
  flatId: string,
  residentType: "OWNER" | "TENANT",
  ownershipProofUrl?: string,
  idProofUrl?: string,
  additionalNotes?: string
}
Response: { success: true, data: OnboardingRequest }
```

#### 5. Check Onboarding Status
```
GET /api/v1/resident/onboarding/status
Response: {
  success: true,
  data: {
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED",
    request: OnboardingRequest
  }
}
```

---

### Family Management Endpoints

#### 1. Invite Family Member (Primary Resident Only)
```
POST /api/v1/resident/family/invite
Body: {
  phone: string,
  name: string,
  email?: string,
  familyRole: "SPOUSE" | "CHILD" | "PARENT" | "SIBLING" | "OTHER"
}
Response: {
  success: true,
  message: "Family member invited",
  data: User
}
Validations:
- Max 6 family members per flat
- Only primary resident can invite
- Phone must be unique
```

#### 2. Get Family Members
```
GET /api/v1/resident/family
Response: {
  success: true,
  data: Array<{
    id, name, phone, email, photoUrl,
    isPrimaryResident, familyRole, isActive, createdAt
  }>
}
Sorted: Primary first, then by createdAt
```

#### 3. Remove Family Member (Primary Resident Only)
```
DELETE /api/v1/resident/family/:memberId
Response: { success: true, message: "Family member removed" }
Validations:
- Only primary resident can remove
- Cannot remove self
- Cannot remove if already resolved complaints exist
```

#### 4. Update Family Role (Primary Resident Only)
```
PATCH /api/v1/resident/family/:memberId/role
Body: { familyRole: "SPOUSE" | "CHILD" | etc. }
Response: { success: true, data: User }
```

---

### Gate Management Endpoints

#### Gate Entries (Guard App)

##### 1. Create Entry (Guard)
```
POST /api/v1/gate/entries
Headers: { Authorization: Bearer <guard-token> }
Body: {
  type: "VISITOR" | "DELIVERY" | "DOMESTIC_STAFF" | "VENDOR",
  visitorName: string,
  visitorPhone?: string,
  visitorType: "GUEST" | "DELIVERY" | "SERVICE_PROVIDER" | "OTHER",
  purpose?: string,
  vehicleNumber?: string,
  flatId: string,
  societyId: string,
  gatePointId?: string,
  domesticStaffId?: string,  // If staff entry
  preApprovalId?: string      // If pre-approved
}
Response: {
  success: true,
  data: Entry (with status: "PENDING")
}
```

##### 2. Get Today's Entries (Guard)
```
GET /api/v1/gate/entries/today
Response: {
  success: true,
  data: Array<Entry> (checked in today, not yet checked out)
}
```

##### 3. Checkout Entry (Guard)
```
PATCH /api/v1/gate/entries/:id/checkout
Body: { remarks?: string }
Response: { success: true, data: Entry (with checkOutTime) }
```

##### 4. Get Pending Approvals (Resident)
```
GET /api/v1/gate/entries/pending
Response: {
  success: true,
  data: Array<Entry> (status: "PENDING", for user's flat)
}
```

##### 5. Approve Entry (Resident)
```
PATCH /api/v1/gate/entries/:id/approve
Response: { success: true, data: Entry (status: "APPROVED") }
```

##### 6. Reject Entry (Resident)
```
PATCH /api/v1/gate/entries/:id/reject
Body: { rejectionReason: string }
Response: { success: true, data: Entry (status: "REJECTED") }
```

#### Entry Requests with Photo (Guard App)

##### 1. Create Entry Request
```
POST /api/v1/gate/requests
Body: {
  type: "DELIVERY" | "VISITOR",
  visitorName?: string,
  visitorPhone?: string,
  providerTag?: "SWIGGY" | "ZOMATO" | "AMAZON" | "FLIPKART" | "BLINKIT",
  photoKey: string,  // S3 key from upload
  flatId: string,
  societyId: string
}
Response: {
  success: true,
  data: EntryRequest (expires in 15 minutes)
}
```

##### 2. Get Pending Requests (Resident)
```
GET /api/v1/gate/requests/pending
Response: {
  success: true,
  data: Array<EntryRequest> (with photoUrl)
}
```

##### 3. Approve Request (Resident)
```
PATCH /api/v1/gate/requests/:id/approve
Response: {
  success: true,
  message: "Approved. Entry created.",
  data: { request: EntryRequest, entry: Entry }
}
```

##### 4. Reject Request (Resident)
```
PATCH /api/v1/gate/requests/:id/reject
Body: { rejectionReason: string }
Response: { success: true, data: EntryRequest }
```

#### Pre-Approvals (Resident App)

##### 1. Create Pre-Approval
```
POST /api/v1/gate/preapprovals
Body: {
  visitorName: string,
  visitorPhone?: string,
  visitorType: "GUEST" | "DELIVERY" | "SERVICE_PROVIDER",
  purpose?: string,
  validFrom: DateTime,
  validUntil: DateTime,
  maxUsageCount?: number,
  vehicleNumber?: string,
  notes?: string
}
Response: { success: true, data: PreApproval }
```

##### 2. Get Active Pre-Approvals
```
GET /api/v1/gate/preapprovals?status=ACTIVE
Response: {
  success: true,
  data: Array<PreApproval>
}
```

##### 3. Cancel Pre-Approval
```
PATCH /api/v1/gate/preapprovals/:id/cancel
Response: { success: true, data: PreApproval (status: "CANCELLED") }
```

#### Gate Passes (Resident App)

##### 1. Request Gate Pass
```
POST /api/v1/gate/passes
Body: {
  passType: "MATERIAL" | "VEHICLE" | "MOVE_IN" | "MOVE_OUT" | "MAINTENANCE",
  purpose: string,
  validFrom: DateTime,
  validUntil: DateTime,
  vehicleNumber?: string,
  contractorName?: string,
  contractorPhone?: string,
  materialDetails?: string
}
Response: { success: true, data: GatePass (status: "PENDING") }
```

##### 2. Get My Gate Passes
```
GET /api/v1/gate/passes
Response: {
  success: true,
  data: Array<GatePass>
}
```

##### 3. Approve Gate Pass (Admin)
```
PATCH /api/v1/gate/passes/:id/approve
Response: { success: true, data: GatePass (status: "APPROVED") }
```

---

### Staff Management Endpoints

#### Domestic Staff (Resident + Admin)

##### 1. Get Staff List
```
GET /api/v1/staff/domestic?societyId=xxx&staffType=MAID&isActive=true
Query params:
- societyId (required)
- staffType: MAID | COOK | DRIVER | CLEANER | GARDENER | PLUMBER | ELECTRICIAN | SECURITY | OTHER
- availabilityStatus: AVAILABLE | BUSY | ON_LEAVE
- isVerified: true/false
- search: string
- page, limit

Response: {
  success: true,
  data: {
    staff: Array<DomesticStaff>,
    pagination: { total, page, limit, pages }
  }
}
```

##### 2. Create Staff (Admin)
```
POST /api/v1/staff/domestic
Body: {
  name: string,
  phone: string,
  email?: string,
  photoUrl?: string,
  staffType: string,
  experienceYears?: number,
  languages?: string[],
  idProofType?: string,
  idProofNumber?: string,
  idProofUrl?: string,
  address?: string,
  workingDays?: string[],
  workStartTime?: string,
  workEndTime?: string,
  hourlyRate?: number,
  monthlyRate?: number,
  societyId: string
}
Response: {
  success: true,
  data: DomesticStaff (with qrToken generated)
}
```

##### 3. Scan QR Code (Guard)
```
POST /api/v1/staff/domestic/qr-scan
Body: {
  qrToken: string,
  flatId: string,
  societyId: string
}
Response: {
  success: true,
  data: StaffAttendance,
  action: "CHECK_IN" | "CHECK_OUT"
}

Logic:
- If staff.isCurrentlyWorking = false → CHECK IN
- If staff.isCurrentlyWorking = true → CHECK OUT
- Notifications sent to flat residents
```

##### 4. Get Attendance Records
```
GET /api/v1/staff/domestic/attendance?domesticStaffId=xxx&startDate=2024-01-01&endDate=2024-01-31
Response: {
  success: true,
  data: {
    records: Array<{
      id, checkInTime, checkOutTime, duration,
      domesticStaff: { name, staffType },
      flat: { flatNumber },
      verifiedByGuard: { name }
    }>,
    pagination: { ... }
  }
}
```

##### 5. Assign Staff to Flat
```
POST /api/v1/staff/domestic/assignments
Body: {
  domesticStaffId: string,
  flatId: string,
  workSchedule?: string,
  agreedRate?: number,
  rateType?: "HOURLY" | "DAILY" | "MONTHLY",
  startDate: DateTime,
  notes?: string
}
Response: { success: true, data: StaffFlatAssignment }
```

---

### Community Endpoints

#### Complaints (Resident App)

##### 1. Create Complaint
```
POST /api/v1/community/complaints
Body: {
  category: "MAINTENANCE" | "NOISE" | "PARKING" | "CLEANLINESS" | "SECURITY" | "OTHER",
  priority: "LOW" | "MEDIUM" | "HIGH",
  title: string,
  description: string,
  images: string[],  // S3 URLs (max 5)
  location?: string,
  isAnonymous?: boolean
}
Response: { success: true, data: Complaint }
```

##### 2. Get My Complaints (Resident)
```
GET /api/v1/community/complaints?status=OPEN
Response: {
  success: true,
  data: {
    complaints: Array<Complaint>,
    pagination: { ... }
  }
}
```

##### 3. Get All Complaints (Admin)
```
GET /api/v1/community/complaints?category=MAINTENANCE&status=OPEN
Response: {
  success: true,
  data: {
    complaints: Array<Complaint> (all in society),
    pagination: { ... }
  }
}
```

##### 4. Get Complaint Details
```
GET /api/v1/community/complaints/:id
Response: {
  success: true,
  data: Complaint (with images array, reportedBy, assignedTo, resolution)
}
```

##### 5. Update Status (Admin)
```
PATCH /api/v1/community/complaints/:id/status
Body: { status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" }
Response: { success: true, data: Complaint }
```

##### 6. Assign Complaint (Admin)
```
PATCH /api/v1/community/complaints/:id/assign
Body: { assignedToId: string }
Response: { success: true, data: Complaint }
```

##### 7. Resolve Complaint (Admin)
```
PATCH /api/v1/community/complaints/:id/resolve
Body: { resolution: string }
Response: { success: true, data: Complaint }
```

##### 8. Delete Complaint (Resident - own only)
```
DELETE /api/v1/community/complaints/:id
Response: { success: true, message: "Complaint deleted" }
Validation: Cannot delete resolved complaints
```

#### Amenities

##### 1. Get Amenities
```
GET /api/v1/community/amenities?societyId=xxx
Response: {
  success: true,
  data: Array<{
    id, name, description, amenityType,
    capacity, pricePerHour, availableDays,
    openTime, closeTime, photoUrls, isActive
  }>
}
```

##### 2. Create Booking
```
POST /api/v1/community/amenities/bookings
Body: {
  amenityId: string,
  bookingDate: DateTime,
  startTime: string,  // "14:00"
  endTime: string,    // "16:00"
  numberOfPeople?: number,
  purpose?: string
}
Response: {
  success: true,
  data: AmenityBooking (status: "PENDING")
}
```

##### 3. Get My Bookings
```
GET /api/v1/community/amenities/bookings?status=CONFIRMED
Response: {
  success: true,
  data: {
    bookings: Array<AmenityBooking>,
    pagination: { ... }
  }
}
```

##### 4. Cancel Booking
```
PATCH /api/v1/community/amenities/bookings/:id/cancel
Response: { success: true, data: AmenityBooking }
```

#### Notices

##### 1. Get Notices
```
GET /api/v1/community/notices?societyId=xxx
Response: {
  success: true,
  data: Array<{
    id, title, description, category, priority,
    publishAt, expiresAt, createdBy: { name }
  }>
}
```

##### 2. Create Notice (Admin)
```
POST /api/v1/community/notices
Body: {
  title: string,
  description: string,
  category: "GENERAL" | "MAINTENANCE" | "EVENT" | "URGENT" | "FINANCIAL",
  priority: "LOW" | "MEDIUM" | "HIGH",
  publishAt?: DateTime,
  expiresAt?: DateTime,
  attachments?: string[]
}
Response: { success: true, data: Notice }
```

#### Emergencies

##### 1. Create Emergency Alert
```
POST /api/v1/community/emergencies
Body: {
  emergencyType: "FIRE" | "MEDICAL" | "SECURITY" | "ACCIDENT" | "OTHER",
  description: string,
  location?: string,
  contactNumber?: string
}
Response: {
  success: true,
  data: Emergency,
  message: "Alert sent to security and admin"
}
```

##### 2. Get Emergencies
```
GET /api/v1/community/emergencies?status=ACTIVE
Response: {
  success: true,
  data: Array<Emergency>
}
```

##### 3. Respond to Emergency (Admin/Guard)
```
PATCH /api/v1/community/emergencies/:id/respond
Body: {
  response: string,
  status: "ACKNOWLEDGED" | "RESOLVED"
}
Response: { success: true, data: Emergency }
```

---

### Notifications

#### 1. Get Notifications
```
GET /api/v1/resident/notifications?limit=50
Response: {
  success: true,
  data: Array<{
    id, type, title, message, data,
    isRead, createdAt
  }>
}

Types:
- ENTRY_REQUEST
- ENTRY_APPROVED
- STAFF_CHECK_IN
- STAFF_CHECK_OUT
- COMPLAINT_UPDATE
- BOOKING_CONFIRMED
- EMERGENCY_ALERT
- NOTICE_PUBLISHED
- SYSTEM
```

#### 2. Get Unread Count
```
GET /api/v1/resident/notifications/unread
Response: {
  success: true,
  data: { count: number }
}
```

#### 3. Mark as Read
```
PATCH /api/v1/resident/notifications/:id/read
Response: { success: true }
```

#### 4. Mark All as Read
```
PATCH /api/v1/resident/notifications/mark-all-read
Response: { success: true, message: "All marked as read" }
```

---

### File Upload

#### 1. Get Pre-signed URL
```
POST /api/v1/upload/presigned-url
Body: {
  fileType: "image/jpeg" | "image/png" | "application/pdf",
  folder: "complaints" | "onboarding" | "staff" | "entry-requests"
}
Response: {
  success: true,
  data: {
    uploadUrl: string,  // Pre-signed S3 URL
    s3Key: string       // File key in S3
  }
}
```

#### 2. Upload File to S3
```
// Use the uploadUrl from step 1
PUT <uploadUrl>
Headers: { Content-Type: <fileType> }
Body: <binary file data>

// No authentication needed (pre-signed URL)
```

#### 3. Use S3 Key in API
```
// After upload, construct public URL
const photoUrl = `https://s3.amazonaws.com/bucket-name/${s3Key}`;

// Use in complaint creation
POST /api/v1/community/complaints
Body: {
  title: "Issue",
  description: "Details",
  images: [photoUrl]  // Use the S3 URL
}
```

---

## Real-time Features (Socket.IO)

### Connection Setup

```typescript
import io from 'socket.io-client';

const socket = io('https://api.yourapp.com', {
  auth: {
    token: authToken  // JWT token
  },
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO');
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### Event Listeners

```typescript
// Listen for notifications
socket.on('notification', (data) => {
  /*
  data: {
    type: "STAFF_CHECKIN" | "STAFF_CHECKOUT" | "ENTRY_REQUEST" | etc.,
    title: string,
    message: string,
    data: { ... }
  }
  */

  // Show push notification
  showNotification(data.title, data.message);

  // Update notification badge
  setUnreadCount(prev => prev + 1);

  // Refresh notification list if screen is active
  if (isNotificationScreenActive) {
    fetchNotifications();
  }
});

// Listen for entry status updates
socket.on('entry:status-updated', (entry) => {
  // Refresh pending entries list
  fetchPendingEntries();
});

// Listen for complaint updates
socket.on('complaint:updated', (complaint) => {
  // Refresh complaint details
  if (currentComplaintId === complaint.id) {
    fetchComplaintDetails(complaint.id);
  }
});
```

### Real-time Notification Examples

#### Staff Check-In Notification ✅ NOW IMPLEMENTED
```javascript
// When guard scans QR for staff entry
socket.on('notification', (data) => {
  /*
  {
    type: "STAFF_CHECKIN",  // Note: No underscore
    title: "Staff Check-In",
    message: "Sunita (MAID) has checked in",
    data: {
      staffId: "xxx",
      staffName: "Sunita",
      staffType: "MAID",
      checkInTime: "2024-01-15T09:30:00Z"
    },
    referenceId: "attendance-id",
    referenceType: "StaffAttendance"
  }
  */
});
```

#### Staff Check-Out Notification ✅ NOW IMPLEMENTED
```javascript
// When guard scans QR for staff exit
socket.on('notification', (data) => {
  /*
  {
    type: "STAFF_CHECKOUT",  // Note: No underscore
    title: "Staff Check-Out",
    message: "Sunita (MAID) has checked out. Duration: 120 minutes",
    data: {
      staffId: "xxx",
      staffName: "Sunita",
      staffType: "MAID",
      checkOutTime: "2024-01-15T11:30:00Z",
      duration: 120  // in minutes
    },
    referenceId: "attendance-id",
    referenceType: "StaffAttendance"
  }
  */
});
```

#### Entry Request Notification
```javascript
socket.on('notification', (data) => {
  /*
  {
    type: "ENTRY_REQUEST",
    title: "Visitor Approval Required",
    message: "A visitor is waiting at gate. Tap to approve.",
    data: {
      requestId: "xxx",
      visitorName: "John Doe",
      photoUrl: "https://s3.../photo.jpg"
    }
  }
  */
});
```

---

## App Flows & User Journeys

### Flow 1: Resident Onboarding (Complete Journey)

```
1. Download App
2. Tap "Register"
3. Enter phone number → Send OTP
4. Enter OTP + Name + Email → Verify
5. Token received → User inactive
6. Onboarding Screen:
   - Select Society (dropdown)
   - Select Block (dropdown after society selected)
   - Select Flat (dropdown after block selected)
   - Select Resident Type (Owner/Tenant)
   - Upload ownership proof (optional)
   - Upload ID proof (optional)
   - Add notes (optional)
7. Submit onboarding request
8. Show "Waiting for admin approval" screen
9. Poll onboarding status every 30 seconds
10. Admin approves
11. User receives notification
12. User logs out and logs in again
13. User is now active + primary resident
14. Navigate to Home Dashboard
```

### Flow 2: Family Member Invitation

```
1. Primary resident taps "Add Family Member"
2. Enter phone, name, email, select relationship
3. Tap "Invite"
4. System creates inactive user + sends OTP
5. Family member receives SMS
6. Family member downloads app
7. Taps "I have an OTP"
8. Enters phone + OTP
9. System detects invitation → activates immediately
10. Family member can now login and access app
```

### Flow 3: Visitor Entry (Guard Perspective)

```
1. Visitor arrives at gate
2. Guard opens app → "New Entry" screen
3. Guard enters:
   - Visitor name
   - Phone (optional)
   - Purpose
   - Vehicle number (if applicable)
4. Guard takes photo (optional)
5. Guard selects flat from dropdown
6. If photo taken → Creates EntryRequest
   else → Creates Entry directly
7. Resident receives real-time notification
8. Resident approves/rejects
9. Guard sees approval → Allows entry
10. When visitor leaves → Guard taps "Checkout"
```

### Flow 4: Maid Entry/Exit (QR Based)

```
Check-In:
1. Maid arrives at gate
2. Maid shows QR code (printed card)
3. Guard scans QR code
4. System checks:
   - Is staff active?
   - Is currently working? → NO
5. System creates check-in:
   - StaffAttendance record created
   - staff.isCurrentlyWorking = true
6. Flat residents receive notification:
   "Sunita (Maid) has entered at 9:30 AM"
7. Maid proceeds to flat

Check-Out:
1. Maid leaves society
2. Maid shows same QR code
3. Guard scans QR code
4. System checks:
   - Is currently working? → YES
5. System creates check-out:
   - StaffAttendance updated with checkOutTime
   - Duration calculated
   - staff.isCurrentlyWorking = false
6. Flat residents receive notification:
   "Sunita (Maid) has left after 180 minutes"
```

### Flow 5: Complaint with Photos

```
1. Resident taps "File Complaint"
2. Select category (Maintenance, Noise, etc.)
3. Enter title & description
4. Tap "Add Photos" (can add up to 5)
5. For each photo:
   a. Take photo or select from gallery
   b. Upload to S3:
      - Get presigned URL
      - Upload file
      - Store S3 URL
6. Select priority (Low/Medium/High)
7. Enter location (optional)
8. Tap "Submit"
9. Complaint created
10. Admin receives notification
11. Admin views complaint (sees all photos)
12. Admin assigns to staff
13. Staff resolves
14. Resident receives "Complaint resolved" notification
```

### Flow 6: Amenity Booking

```
1. Resident taps "Book Amenity"
2. See list of amenities (Gym, Pool, Hall, etc.)
3. Tap on amenity
4. See details + available time slots
5. Select date
6. Select time slot (e.g., 14:00 - 16:00)
7. Enter number of people
8. Enter purpose (optional)
9. Tap "Book"
10. Show booking confirmation
11. Admin auto-approves or manually approves
12. Resident receives confirmation notification
13. On booking day, receive reminder notification
14. After time slot, booking auto-completes
```

---

## Data Models

### User Model
```typescript
interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'GUARD' | 'RESIDENT';
  photoUrl?: string;
  isActive: boolean;

  // Resident specific
  flatId?: string;
  flat?: Flat;
  societyId?: string;
  society?: Society;
  isOwner: boolean;

  // Family member fields
  isPrimaryResident: boolean;
  familyRole?: 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
  primaryResidentId?: string;
  primaryResident?: User;
  familyMembers: User[];

  createdAt: Date;
  updatedAt: Date;
}
```

### Society Model
```typescript
interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactEmail?: string;
  contactPhone?: string;
  totalFlats: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Flat Model
```typescript
interface Flat {
  id: string;
  flatNumber: string;
  floor?: string;
  blockId?: string;
  block?: Block;
  societyId: string;
  society: Society;
  isOccupied: boolean;
  residents: User[];
}
```

### Entry Model
```typescript
interface Entry {
  id: string;
  type: 'VISITOR' | 'DELIVERY' | 'DOMESTIC_STAFF' | 'VENDOR';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHECKED_OUT';

  visitorName: string;
  visitorPhone?: string;
  visitorType: 'GUEST' | 'DELIVERY' | 'SERVICE_PROVIDER' | 'OTHER';
  visitorPhoto?: string;
  purpose?: string;
  vehicleNumber?: string;

  flatId: string;
  flat: Flat;
  societyId: string;

  createdById: string;  // Guard who created
  createdBy: User;

  approvedById?: string;
  approvedBy?: User;
  approvedAt?: Date;

  checkInTime: Date;
  checkOutTime?: Date;

  preApprovalId?: string;
  domesticStaffId?: string;

  remarks?: string;
  rejectionReason?: string;

  createdAt: Date;
}
```

### DomesticStaff Model
```typescript
interface DomesticStaff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  photoUrl?: string;

  staffType: 'MAID' | 'COOK' | 'DRIVER' | 'CLEANER' | 'GARDENER' | 'PLUMBER' | 'ELECTRICIAN' | 'SECURITY' | 'OTHER';
  experienceYears?: number;
  languages: string[];
  idProofType?: string;
  idProofNumber?: string;
  idProofUrl?: string;

  workingDays: string[];  // ["MON", "TUE", "WED"]
  workStartTime?: string;  // "09:00"
  workEndTime?: string;    // "18:00"

  hourlyRate?: number;
  monthlyRate?: number;

  rating: number;
  totalReviews: number;
  isVerified: boolean;

  societyId: string;
  qrToken: string;  // Unique QR code

  isActive: boolean;
  isCurrentlyWorking: boolean;
  currentFlatId?: string;
  lastCheckIn?: Date;
  lastCheckOut?: Date;

  assignedFlats: StaffFlatAssignment[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Complaint Model
```typescript
interface Complaint {
  id: string;
  category: 'MAINTENANCE' | 'NOISE' | 'PARKING' | 'CLEANLINESS' | 'SECURITY' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED';

  title: string;
  description: string;
  images: string[];  // Array of S3 URLs (max 5)
  location?: string;

  reportedById: string;
  reportedBy: User;
  flatId?: string;
  flat?: Flat;
  societyId: string;

  assignedToId?: string;
  assignedTo?: User;
  assignedAt?: Date;

  resolvedById?: string;
  resolvedBy?: User;
  resolvedAt?: Date;
  resolution?: string;

  isAnonymous: boolean;

  createdAt: Date;
  updatedAt: Date;
}
```

### Notification Model
```typescript
interface Notification {
  id: string;
  userId: string;
  user: User;

  type: 'ENTRY_REQUEST' | 'ENTRY_APPROVED' | 'STAFF_CHECK_IN' | 'STAFF_CHECK_OUT' |
        'COMPLAINT_UPDATE' | 'BOOKING_CONFIRMED' | 'EMERGENCY_ALERT' |
        'NOTICE_PUBLISHED' | 'SYSTEM';

  title: string;
  message: string;
  data?: any;  // Additional contextual data

  isRead: boolean;
  createdAt: Date;
}
```

---

## UI/UX Requirements

### Design System

#### Colors
```typescript
const colors = {
  primary: '#4F46E5',      // Indigo
  secondary: '#10B981',    // Green
  danger: '#EF4444',       // Red
  warning: '#F59E0B',      // Amber
  info: '#3B82F6',         // Blue

  background: '#F9FAFB',   // Light gray
  surface: '#FFFFFF',

  text: {
    primary: '#111827',
    secondary: '#6B7280',
    disabled: '#9CA3AF'
  },

  border: '#E5E7EB',

  status: {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
    active: '#3B82F6'
  }
};
```

#### Typography
```typescript
const typography = {
  h1: { fontSize: 32, fontWeight: 'bold' },
  h2: { fontSize: 24, fontWeight: 'bold' },
  h3: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: 'normal' },
  caption: { fontSize: 14, fontWeight: 'normal' },
  small: { fontSize: 12, fontWeight: 'normal' }
};
```

### Screen Structure (Resident App)

#### 1. Authentication Screens
- **Login Screen**: Phone + Password fields, "Register" link, "Forgot Password"
- **Register Screen**: Phone input, "Send OTP" button
- **OTP Verification**: OTP input (6 digits), Name, Email fields
- **Onboarding Flow**: Society → Block → Flat selection, document upload

#### 2. Home Dashboard (Resident)
```
┌─────────────────────────────┐
│ Welcome, John!              │
│ A-101, Tower A              │
├─────────────────────────────┤
│ Quick Actions               │
│ [Entry]  [Staff]  [Book]   │
│ [Alert]  [Complaint]        │
├─────────────────────────────┤
│ Pending Approvals (3)       │
│ • Visitor at gate           │
│ • Delivery request          │
│ • Gate pass approval        │
├─────────────────────────────┤
│ Recent Activity             │
│ • Maid checked in 09:30 AM  │
│ • Complaint resolved        │
└─────────────────────────────┘
```

#### 3. Bottom Navigation (Resident App)
- **Home**: Dashboard with quick actions
- **Gate**: Entries, pre-approvals, gate passes
- **Staff**: Domestic staff, attendance
- **Community**: Notices, amenities, complaints
- **Profile**: Settings, family, logout

#### 4. Gate Management Screen
```
Tabs:
- Entries (View all entries)
- Pending (Approvals needed)
- Pre-approvals (Active pre-approvals)
- Gate Passes (My gate passes)
```

#### 5. Complaint Screen
```
┌─────────────────────────────┐
│ File Complaint         [+]  │
├─────────────────────────────┤
│ My Complaints               │
│                             │
│ [OPEN] Lift not working     │
│ Maintenance • High          │
│ Filed: 2 hours ago          │
│                             │
│ [IN_PROGRESS] Water leak    │
│ Maintenance • Medium        │
│ Assigned to: Plumber        │
│ Filed: 1 day ago            │
└─────────────────────────────┘
```

### Screen Structure (Guard App)

#### 1. Home Dashboard (Guard)
```
┌─────────────────────────────┐
│ On Duty - Gate 1            │
│ Today: 15 entries           │
├─────────────────────────────┤
│ Quick Actions               │
│ [New Entry] [Scan QR]       │
│ [Checkout]  [View Entries]  │
├─────────────────────────────┤
│ Active Entries (5)          │
│ • John Doe - A-101          │
│   Checked in: 10:30 AM      │
│ • Delivery - B-205          │
│   Checked in: 11:15 AM      │
└─────────────────────────────┘
```

#### 2. Bottom Navigation (Guard App)
- **Home**: Dashboard
- **Entry**: Create new entry
- **QR Scan**: Scan staff QR codes
- **Entries**: Today's entries, checkout
- **Profile**: Settings, logout

#### 3. QR Scanner Screen
```
┌─────────────────────────────┐
│ Scan QR Code                │
│                             │
│   ┌───────────────────┐     │
│   │                   │     │
│   │     [QR CODE]     │     │
│   │      VIEWER       │     │
│   │                   │     │
│   └───────────────────┘     │
│                             │
│ Point camera at staff       │
│ QR code for check-in/out    │
└─────────────────────────────┘
```

### Key UI Components

#### 1. Entry Card
```tsx
<View style={styles.entryCard}>
  <View style={styles.header}>
    <Avatar source={{ uri: entry.visitorPhoto }} />
    <View>
      <Text style={styles.name}>{entry.visitorName}</Text>
      <Text style={styles.meta}>
        {entry.visitorType} • {entry.flatNumber}
      </Text>
    </View>
    <StatusBadge status={entry.status} />
  </View>

  <Text style={styles.purpose}>{entry.purpose}</Text>

  <View style={styles.footer}>
    <Text style={styles.time}>
      {formatTime(entry.checkInTime)}
    </Text>
    {entry.status === 'PENDING' && (
      <View style={styles.actions}>
        <Button title="Approve" onPress={handleApprove} />
        <Button title="Reject" onPress={handleReject} />
      </View>
    )}
  </View>
</View>
```

#### 2. Staff QR Code Display
```tsx
<View style={styles.qrContainer}>
  <QRCode
    value={staff.qrToken}
    size={200}
  />
  <Text style={styles.staffName}>{staff.name}</Text>
  <Text style={styles.staffType}>{staff.staffType}</Text>
  <Text style={styles.instruction}>
    Show this QR at gate for check-in/out
  </Text>
</View>
```

#### 3. Notification Item
```tsx
<TouchableOpacity
  style={[styles.notification, !isRead && styles.unread]}
  onPress={handlePress}
>
  <View style={styles.icon}>
    <Icon name={getIconForType(type)} />
  </View>
  <View style={styles.content}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    <Text style={styles.time}>{formatRelativeTime(createdAt)}</Text>
  </View>
  {!isRead && <View style={styles.unreadDot} />}
</TouchableOpacity>
```

---

## Implementation Checklist

### Phase 1: Core Setup
- [ ] Initialize React Native project (Expo or bare workflow)
- [ ] Setup folder structure
- [ ] Install dependencies (axios, socket.io-client, react-navigation, etc.)
- [ ] Configure API base URL and environment variables
- [ ] Setup authentication context (JWT storage)
- [ ] Implement axios interceptors (token injection, error handling)
- [ ] Setup navigation structure (Stack, Tab, Drawer navigators)

### Phase 2: Authentication
- [ ] Login screen (phone + password)
- [ ] Register screen (phone number input)
- [ ] OTP verification screen
- [ ] Onboarding flow (society/block/flat selection)
- [ ] Token management (storage, refresh, expiry)
- [ ] Role-based navigation (Resident vs Guard app)

### Phase 3: Resident App - Core Features
- [ ] Home dashboard
- [ ] Profile screen (view/edit)
- [ ] Family management (list, invite, remove)
- [ ] Notification center
- [ ] Socket.IO integration

### Phase 4: Gate Management (Resident)
- [ ] View entries list
- [ ] Pending approvals (swipe to approve/reject)
- [ ] Entry request with photo viewer
- [ ] Pre-approval creation
- [ ] Pre-approval list
- [ ] Gate pass request
- [ ] Gate pass list

### Phase 5: Staff Management (Resident)
- [ ] View assigned staff list
- [ ] Staff details screen
- [ ] Staff QR code display
- [ ] Attendance history
- [ ] Staff booking

### Phase 6: Community Features (Resident)
- [ ] Notices list
- [ ] Notice details
- [ ] Amenity list
- [ ] Amenity booking flow
- [ ] Complaint creation (with photo upload)
- [ ] My complaints list
- [ ] Complaint details (with photo gallery)
- [ ] Emergency alert button

### Phase 7: Guard App
- [ ] Guard dashboard
- [ ] New entry creation
- [ ] QR code scanner (camera integration)
- [ ] Today's entries list
- [ ] Entry checkout
- [ ] Entry request creation (with camera)

### Phase 8: File Upload
- [ ] Image picker integration
- [ ] S3 presigned URL flow
- [ ] Photo gallery component
- [ ] Document upload (PDF)
- [ ] Progress indicator

### Phase 9: Real-time Features
- [ ] Socket.IO connection management
- [ ] Real-time notification listeners
- [ ] Push notification integration (FCM/APNs)
- [ ] Badge count updates
- [ ] Auto-refresh on socket events

### Phase 10: Polish & Optimization
- [ ] Loading states and skeletons
- [ ] Error handling and retry logic
- [ ] Offline support (cache important data)
- [ ] Pull-to-refresh
- [ ] Infinite scroll/pagination
- [ ] Image caching and optimization
- [ ] App state management (Redux/Context)
- [ ] Deep linking
- [ ] Analytics integration

---

## Tech Stack Recommendations

### Core
- **React Native** (Latest stable version)
- **TypeScript** (Type safety)
- **Expo** (Recommended) or bare React Native

### Navigation
- **@react-navigation/native** (Stack, Tab, Drawer navigators)
- **@react-navigation/bottom-tabs**
- **@react-navigation/stack**

### State Management
- **React Context API** (For simple state)
- **Redux Toolkit** (For complex state)
- **@tanstack/react-query** (For server state caching)

### API & Real-time
- **axios** (HTTP requests)
- **socket.io-client** (Real-time communication)

### UI Components
- **react-native-paper** (Material Design)
- **@rneui/themed** (React Native Elements)
- **react-native-vector-icons**

### Forms & Validation
- **react-hook-form** (Form management)
- **yup** or **zod** (Validation)

### Camera & Media
- **expo-camera** (Camera access)
- **expo-image-picker** (Gallery access)
- **react-native-qrcode-scanner** (QR scanning)
- **react-native-qrcode-svg** (QR generation)

### Notifications
- **expo-notifications** (Local notifications)
- **@react-native-firebase/messaging** (Push notifications)

### Storage
- **@react-native-async-storage/async-storage** (Persistent storage)

### Date & Time
- **date-fns** or **dayjs** (Date formatting)

### Other
- **react-native-fast-image** (Image caching)
- **react-native-gesture-handler** (Gestures)
- **react-native-reanimated** (Animations)

---

## Environment Variables

```env
# .env file
API_BASE_URL=https://api.yourapp.com/api/v1
SOCKET_URL=https://api.yourapp.com
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
FCM_SERVER_KEY=your-fcm-key
```

---

## Testing Strategy

### Unit Tests
- Utility functions (date formatting, validation)
- Redux reducers/actions
- Custom hooks

### Integration Tests
- API service functions
- Authentication flow
- Navigation flow

### E2E Tests (Detox)
- Complete user journeys
- Critical paths (login, onboarding, entry approval)

---

## Common Pitfalls to Avoid

1. **Not handling token expiry** - Always check 401 responses
2. **Not implementing offline support** - Cache critical data
3. **Poor image optimization** - Compress before upload
4. **No loading states** - Always show loaders
5. **Ignoring permissions** - Check camera/gallery permissions before use
6. **Not handling deep links** - Implement for notifications
7. **Forgetting error boundaries** - Catch and display errors gracefully
8. **No retry logic** - Implement exponential backoff for failed requests
9. **Missing socket reconnection** - Handle socket disconnects
10. **Not clearing sensitive data on logout** - Always clear AsyncStorage

---

## Summary

This guide provides a complete blueprint for building the React Native frontend for the Society Gate app. The backend is fully functional with:

✅ Optimized v1 API routes
✅ JWT authentication with role-based access
✅ Family member system (max 6 per flat)
✅ QR-based staff entry/exit
✅ Real-time Socket.IO notifications
✅ Photo upload with S3 presigned URLs
✅ Comprehensive gate management
✅ Community features (complaints, amenities, notices)
✅ Full backward compatibility with legacy routes

Build the frontend following this guide, and you'll have a production-ready society management app!

**Good luck building! 🚀**
