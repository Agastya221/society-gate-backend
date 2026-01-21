# Society Gate - Frontend Development Guide for AI Agents

> **For AI Agent**: This document provides complete specifications to build a React/React Native frontend for the Society Gate society management application. Read this entire document before starting development.

---

## 📋 PROJECT OVERVIEW

**App Name**: Society Gate (MyGate Clone)
**Purpose**: Society/Apartment complex management system
**Backend**: Node.js + Express + Prisma + PostgreSQL
**Real-time**: Socket.IO for notifications
**File Storage**: AWS S3 with pre-signed URLs

### Target Platforms
1. **Resident App** (React Native) - For flat owners/tenants
2. **Guard App** (React Native) - For security guards
3. **Admin Dashboard** (React Web) - For society management

---

## 🔐 AUTHENTICATION SYSTEM

### Base URL
```
Development: http://localhost:4000
Production: <your-production-url>
```

### Auth Header Format
```
Authorization: Bearer <JWT_TOKEN>
```

### Token Storage
- Store JWT token in secure storage (AsyncStorage for React Native, localStorage for Web)
- Token expiry: Resident App (30 days), Guard App (7 days)

### User Roles
| Role | App Access | Description |
|------|------------|-------------|
| `RESIDENT` | Resident App | Flat owner/tenant |
| `ADMIN` | Resident App + Admin Dashboard | Society secretary/management |
| `GUARD` | Guard App | Gate security personnel |
| `SUPER_ADMIN` | Admin Dashboard | Platform-wide admin |

---

## 🎯 APP 1: RESIDENT APP (React Native)

### Authentication Screens

#### 1. Login Screen
```typescript
// POST /api/auth/resident-app/login
Request: {
  phone: string,      // OR email
  password: string
}
Response: {
  success: boolean,
  data: {
    user: User,
    token: string
  }
}
```

#### 2. OTP Login Flow (Alternative)
```typescript
// Step 1: Send OTP
// POST /api/auth/otp/send
Request: { phone: string }

// Step 2: Verify OTP
// POST /api/auth/otp/verify
Request: {
  phone: string,
  otp: string,
  name: string,      // Required for new users
  email?: string
}
Response: {
  success: boolean,
  data: {
    requiresOnboarding: boolean,
    token: string,
    user: User
  }
}
```

### Main Screens & Features

#### 📱 Dashboard/Home Screen
**API Calls Required:**
```typescript
// Get user profile
GET /api/auth/resident-app/profile

// Get pending entries (awaiting approval)
GET /api/entries/pending

// Get notifications
GET /api/notifications
GET /api/notifications/unread-count

// Get active emergencies (for user's flat)
GET /api/emergencies/my
```

**UI Components:**
- Welcome header with user name
- Pending entry approvals card (show count, tap to view)
- Quick actions grid:
  - Pre-approve Guest
  - Request Gate Pass
  - Book Amenity
  - Report Complaint
  - SOS/Emergency button
- Recent notifications list
- Unread notification badge

---

#### 👥 Entry Approval Screen
**Purpose**: Approve/reject visitors waiting at gate

**API Calls:**
```typescript
// Get pending entries for user's flat
GET /api/entries/pending

// Get pending entry requests (guard photo approval)
GET /api/entry-requests?status=PENDING

// Approve entry
PATCH /api/entries/:id/approve

// Reject entry
PATCH /api/entries/:id/reject
Body: { reason?: string }

// Approve entry request
PATCH /api/entry-requests/:id/approve

// Reject entry request
PATCH /api/entry-requests/:id/reject
Body: { rejectionReason?: string }

// View entry request photo
GET /api/entry-requests/:id/photo
Response: { viewUrl: string }
```

**UI Components:**
- List of pending entries with:
  - Visitor name, type, photo (if available)
  - Purpose of visit
  - Approve/Reject buttons
- Pull-to-refresh
- Real-time updates via Socket.IO

**Socket.IO Events to Listen:**
```typescript
socket.on('entry:pending', (data) => { /* New entry waiting */ })
socket.on('notification', (data) => { /* New notification */ })
```

---

#### 🎫 Pre-Approvals Screen
**Purpose**: Create QR codes for expected visitors

**API Calls:**
```typescript
// Create pre-approval
POST /api/preapprovals
Body: {
  visitorName: string,
  visitorPhone: string,
  visitorType: 'GUEST' | 'FAMILY_MEMBER' | 'FRIEND' | 'DELIVERY_PERSON' | 'CAB_DRIVER' | 'SERVICE_PROVIDER' | 'OTHER',
  purpose?: string,
  vehicleNumber?: string,
  validFrom: Date,     // ISO string
  validUntil: Date,    // ISO string
  maxUses?: number     // Default: 1
}
Response: {
  success: boolean,
  data: {
    preApproval: PreApproval,
    qrCode: string     // Base64 QR image
  }
}

// Get all pre-approvals
GET /api/preapprovals?status=ACTIVE

// Get QR code for existing pre-approval
GET /api/preapprovals/:id/qr

// Cancel pre-approval
DELETE /api/preapprovals/:id
```

**UI Components:**
- "Add Pre-Approval" floating button
- Form with:
  - Visitor name (required)
  - Phone number (required, validated)
  - Visitor type dropdown
  - Purpose text input
  - Vehicle number (optional)
  - Valid from date picker
  - Valid until date picker
  - Max uses number input
- List of active pre-approvals
- QR code display modal (shareable)
- Swipe to cancel

---

#### 🚗 Gate Pass Screen
**Purpose**: Request permission for material/vehicle movement

**API Calls:**
```typescript
// Create gate pass
POST /api/gatepasses
Body: {
  type: 'MATERIAL' | 'VEHICLE' | 'MOVE_IN' | 'MOVE_OUT' | 'MAINTENANCE',
  title: string,
  description?: string,
  validFrom: Date,
  validUntil: Date,
  vehicleNumber?: string,
  driverName?: string,
  driverPhone?: string,
  itemsList?: string[],    // For MATERIAL type
  workerName?: string,     // For MAINTENANCE type
  workerPhone?: string,
  companyName?: string
}

// Get user's gate passes
GET /api/gatepasses?flatId={userFlatId}

// Get QR code
GET /api/gatepasses/:id/qr

// Cancel gate pass
DELETE /api/gatepasses/:id
```

**Gate Pass Types:**
- `MATERIAL` - Moving furniture, appliances
- `VEHICLE` - Vehicle entry for repairs/painting
- `MOVE_IN` - New resident moving in
- `MOVE_OUT` - Resident moving out
- `MAINTENANCE` - Contractor/worker access

**UI Components:**
- Type selector cards
- Dynamic form based on type
- Date/time pickers
- Items list input (for MATERIAL)
- Status badges (PENDING, APPROVED, REJECTED, USED, EXPIRED)
- QR code display

---

#### 🏊 Amenity Booking Screen
**Purpose**: Book society amenities (gym, pool, clubhouse)

**API Calls:**
```typescript
// Get available amenities
GET /api/amenities/amenities

// Create booking
POST /api/amenities/bookings
Body: {
  amenityId: string,
  bookingDate: Date,
  startTime: string,    // "HH:MM" format
  endTime: string,      // "HH:MM" format
  guestCount?: number,
  purpose?: string
}

// Get user's bookings
GET /api/amenities/bookings

// Cancel booking
PATCH /api/amenities/bookings/:id/cancel
Body: { cancellationReason?: string }
```

**Amenity Types:**
- CLUBHOUSE, GYM, SWIMMING_POOL, PARTY_HALL, SPORTS_COURT, BANQUET_HALL, GARDEN, OTHER

**UI Components:**
- Amenity cards with images, capacity, price
- Calendar view for date selection
- Time slot picker (show unavailable slots)
- Booking confirmation
- My bookings list with status

---

#### 📝 Complaints Screen
**Purpose**: Report and track complaints

**API Calls:**
```typescript
// Create complaint
POST /api/complaints
Body: {
  category: 'MAINTENANCE' | 'SECURITY' | 'CLEANLINESS' | 'WATER' | 'ELECTRICITY' | 'PARKING' | 'NOISE' | 'PETS' | 'OTHER',
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  title: string,
  description: string,
  location?: string,
  images?: string[]    // S3 keys from upload
}

// Get user's complaints
GET /api/complaints

// Get complaint details
GET /api/complaints/:id

// Delete complaint (if not resolved)
DELETE /api/complaints/:id
```

**UI Components:**
- Category selector with icons
- Priority selector
- Image upload (camera/gallery)
- Complaint list with status colors:
  - OPEN (red)
  - IN_PROGRESS (yellow)
  - RESOLVED (green)
  - CLOSED (gray)
- Complaint detail view with updates

---

#### 🚨 Emergency/SOS Screen
**Purpose**: Panic button for emergencies

**API Calls:**
```typescript
// Create emergency alert
POST /api/emergencies
Body: {
  type: 'MEDICAL' | 'FIRE' | 'THEFT' | 'VIOLENCE' | 'ACCIDENT' | 'OTHER',
  description?: string,
  location?: string
}

// Get user's emergencies
GET /api/emergencies/my
```

**UI Components:**
- Large SOS button (prominent, red)
- Emergency type quick select
- Optional description
- Active emergency status
- Emergency contact numbers display

---

#### 📢 Notices Screen
**Purpose**: View society announcements

**API Calls:**
```typescript
// Get notices
GET /api/notices?page=1&limit=20

// Get pinned notices
GET /api/notices?isPinned=true
```

**UI Components:**
- Pinned notices at top
- Notice cards with:
  - Type badge (color coded)
  - Priority indicator
  - Title, description preview
  - Date posted
- Notice detail view with images/documents

---

#### 👨‍🔧 Domestic Staff Screen
**Purpose**: Manage household help (maid, cook, driver)

**API Calls:**
```typescript
// Get staff assigned to user's flat
GET /api/domestic-staff?flatId={userFlatId}

// Add new staff
POST /api/domestic-staff
Body: {
  name: string,
  phone: string,
  staffType: 'MAID' | 'COOK' | 'NANNY' | 'DRIVER' | 'CLEANER' | 'GARDENER' | 'LAUNDRY' | 'CARETAKER' | 'OTHER',
  workingDays?: string[],
  workStartTime?: string,
  workEndTime?: string,
  hourlyRate?: number,
  monthlyRate?: number
}

// Get staff QR code
GET /api/domestic-staff/:id/qr

// Assign staff to flat
POST /api/domestic-staff/assignments
Body: {
  staffId: string,
  flatId: string,
  workingDays?: string[],
  workStartTime?: string,
  workEndTime?: string,
  agreedRate?: number,
  rateType?: string
}

// View attendance records
GET /api/domestic-staff/attendance/records?staffId={id}

// Add review
POST /api/domestic-staff/reviews
Body: {
  staffId: string,
  flatId: string,
  rating: number,      // 1-5
  review?: string,
  workQuality?: number,
  punctuality?: number,
  behavior?: number
}
```

**UI Components:**
- Staff list with photo, type, rating
- Staff QR code (for check-in/out)
- Attendance calendar view
- Add/edit staff form
- Rating/review form

---

#### 🚗 Vehicle Registration Screen
**Purpose**: Register vehicles for easy entry

**API Calls:**
```typescript
// Get user's vehicles
GET /api/vehicles?flatId={userFlatId}

// Register vehicle
POST /api/vehicles
Body: {
  vehicleNumber: string,
  vehicleType: string,   // "Car", "Bike", "Bicycle"
  model?: string,
  color?: string
}

// Update vehicle
PATCH /api/vehicles/:id

// Delete vehicle
DELETE /api/vehicles/:id
```

---

#### 📦 Delivery Management Screen
**Purpose**: Manage expected deliveries and auto-approve rules

**API Calls:**
```typescript
// Add expected delivery
POST /api/deliveries/expected
Body: {
  flatId: string,
  companyName: string,
  itemName?: string,
  expectedDate: Date,
  timeFrom?: string,
  timeUntil?: string,
  autoApprove?: boolean
}

// Get expected deliveries
GET /api/deliveries/expected

// Create auto-approve rule
POST /api/deliveries/auto-approve
Body: {
  flatId: string,
  companies: string[],     // ["Amazon", "Swiggy", "Zomato"]
  allowedDays?: string[],
  timeFrom?: string,
  timeUntil?: string
}

// Get auto-approve rules
GET /api/deliveries/auto-approve

// Get delivery company list
GET /api/deliveries/companies
Response: ["Amazon", "Flipkart", "Swiggy", "Zomato", "BigBasket", "Dunzo", "Blinkit", ...]
```

---

#### 👤 Profile Screen
**Purpose**: View/edit user profile

**API Calls:**
```typescript
// Get profile
GET /api/auth/resident-app/profile

// Update profile
PATCH /api/auth/resident-app/profile
Body: {
  name?: string,
  email?: string,
  password?: string,
  photoUrl?: string
}
```

---

#### 🔔 Notifications Screen
**Purpose**: View all notifications

**API Calls:**
```typescript
// Get notifications
GET /api/notifications?page=1&limit=20

// Get unread count
GET /api/notifications/unread-count

// Mark as read
PATCH /api/notifications/:id/read

// Mark all as read
PATCH /api/notifications/read-all
```

**Notification Types:**
- `ENTRY_REQUEST` - Visitor at gate
- `DELIVERY_REQUEST` - Delivery waiting
- `EMERGENCY_ALERT` - Emergency in society
- `ONBOARDING_STATUS` - Account approval status
- `SYSTEM` - System announcements

---

## 🎯 APP 2: GUARD APP (React Native)

### Authentication
```typescript
// POST /api/auth/guard-app/login
Request: {
  phone: string,
  password: string
}
```

### Main Screens

#### 📋 Dashboard Screen
**API Calls:**
```typescript
// Get today's entries
GET /api/entries/today

// Get pending entry count
GET /api/entry-requests/pending-count

// Get active emergencies
GET /api/emergencies/active
```

**UI Components:**
- Today's entry count stats
- Pending approvals badge
- Quick action buttons:
  - Scan QR
  - Manual Entry
  - View Entries
- Active emergencies alert banner

---

#### 📸 Create Entry Screen
**Purpose**: Register new visitor/delivery

**API Calls:**
```typescript
// Create entry (visitor/delivery)
POST /api/entries
Body: {
  type: 'VISITOR' | 'DELIVERY' | 'CAB' | 'VENDOR' | 'DOMESTIC_STAFF',
  flatId: string,
  visitorName: string,
  visitorPhone?: string,
  visitorType?: string,
  purpose?: string,
  vehicleNumber?: string,
  companyName?: string,     // For delivery
  packageCount?: number
}

// Create entry request (with photo for resident approval)
POST /api/entry-requests
Body: {
  type: 'VISITOR' | 'DELIVERY' | 'CAB' | 'VENDOR',
  flatId: string,
  visitorName?: string,
  visitorPhone?: string,
  providerTag?: 'SWIGGY' | 'ZOMATO' | 'AMAZON' | 'FLIPKART' | 'BIGBASKET' | 'DUNZO' | 'BLINKIT' | 'OTHER',
  photoKey?: string        // S3 key from camera upload
}
```

**UI Components:**
- Flat number search/select
- Entry type selector
- Camera for visitor photo
- Delivery provider quick-select buttons (Swiggy, Zomato, Amazon, etc.)
- Submit and wait for approval status

---

#### 📷 QR Scanner Screen
**Purpose**: Scan pre-approvals, gate passes, staff QR codes

**API Calls:**
```typescript
// Scan pre-approval
POST /api/preapprovals/scan
Body: { qrToken: string }

// Scan gate pass
POST /api/gatepasses/scan
Body: { qrToken: string }

// Scan domestic staff
POST /api/domestic-staff/scan
Body: { qrToken: string }
```

**UI Components:**
- Camera QR scanner
- Success/failure feedback
- Visitor/pass details display
- Allow entry button

---

#### ✅ Checkout Screen
**Purpose**: Mark visitors as checked out

**API Calls:**
```typescript
// Get checked-in entries
GET /api/entries?status=CHECKED_IN

// Checkout entry
PATCH /api/entries/:id/checkout
```

---

#### 📊 Entry Log Screen
**Purpose**: View today's entry history

**API Calls:**
```typescript
// Get today's entries
GET /api/entries/today

// Get entries with filters
GET /api/entries?status=CHECKED_IN&type=VISITOR&page=1&limit=50
```

---

#### 🚨 Emergency Response Screen
**Purpose**: View and respond to emergencies

**API Calls:**
```typescript
// Get active emergencies
GET /api/emergencies/active

// Respond to emergency
PATCH /api/emergencies/:id/respond
```

---

## 🎯 APP 3: ADMIN DASHBOARD (React Web)

### Main Features

#### 📊 Dashboard
**API Calls:**
```typescript
// Get dashboard stats
GET /api/reports/dashboard

// Get entry reports
GET /api/reports/entries

// Get peak hours
GET /api/reports/peak-hours

// Get complaint stats
GET /api/reports/complaints
```

**UI Components:**
- Total residents, flats, guards count
- Today's entries chart
- Pending approvals count
- Active complaints count
- Recent activity feed

---

#### 👥 User Management
**API Calls:**
```typescript
// Get all guards
GET /api/auth/resident-app/guards

// Create guard
POST /api/auth/resident-app/create-guard

// Toggle user status
PATCH /api/auth/resident-app/users/:id/status
```

---

#### 🏢 Onboarding Management
**API Calls:**
```typescript
// Get pending onboarding requests
GET /api/onboarding/admin/pending

// View request details
GET /api/onboarding/admin/:requestId

// Approve
PATCH /api/onboarding/admin/:requestId/approve

// Reject
PATCH /api/onboarding/admin/:requestId/reject

// Request resubmit
PATCH /api/onboarding/admin/:requestId/request-resubmit
```

---

#### 🎫 Gate Pass Management
**API Calls:**
```typescript
// Get all gate passes
GET /api/gatepasses

// Approve gate pass
PATCH /api/gatepasses/:id/approve

// Reject gate pass
PATCH /api/gatepasses/:id/reject
```

---

#### 📢 Notice Management
**API Calls:**
```typescript
// Create notice
POST /api/notices

// Update notice
PATCH /api/notices/:id

// Delete notice
DELETE /api/notices/:id

// Toggle pin
PATCH /api/notices/:id/toggle-pin
```

---

#### 🏊 Amenity Management
**API Calls:**
```typescript
// Create amenity
POST /api/amenities/amenities

// Update amenity
PATCH /api/amenities/amenities/:id

// Approve/reject bookings
PATCH /api/amenities/bookings/:id/approve
```

---

#### 📝 Complaint Management
**API Calls:**
```typescript
// Get all complaints
GET /api/complaints

// Update status
PATCH /api/complaints/:id/status

// Assign
PATCH /api/complaints/:id/assign

// Resolve
PATCH /api/complaints/:id/resolve
```

---

#### 🚨 Emergency Management
**API Calls:**
```typescript
// Get all emergencies
GET /api/emergencies

// Resolve
PATCH /api/emergencies/:id/resolve

// Mark false alarm
PATCH /api/emergencies/:id/false-alarm
```

---

#### 🔧 Vendor Management
**API Calls:**
```typescript
// Create vendor
POST /api/vendors

// Get vendors
GET /api/vendors

// Verify vendor
PATCH /api/vendors/:id/verify
```

---

## 🔌 SOCKET.IO INTEGRATION

### Connection Setup
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: 'JWT_TOKEN_HERE'
  }
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

### Events to Listen (Resident App)
```typescript
// New entry pending approval
socket.on('entry:pending', (data) => {
  // Show notification, refresh pending list
  // data: { entryId, visitorName, flatId, type }
});

// Entry approved/rejected by someone else
socket.on('entry:approved', (data) => { });
socket.on('entry:rejected', (data) => { });

// New notification
socket.on('notification', (data) => {
  // Update notification badge
  // data: Notification object
});

// Emergency alert
socket.on('emergency:alert', (data) => {
  // Show alert modal
  // data: Emergency object
});

// Complaint status updated
socket.on('complaint:status-updated', (data) => {
  // Refresh complaint if viewing
});

// Pong (keepalive)
socket.on('pong', () => { });
```

### Events to Listen (Guard App)
```typescript
// Entry approved by resident
socket.on('entry:approved', (data) => {
  // Update entry status in UI
});

// Entry rejected by resident
socket.on('entry:rejected', (data) => {
  // Show rejection, inform visitor
});

// Emergency alert
socket.on('emergency:alert', (data) => {
  // Show prominent alert
});
```

---

## 📤 FILE UPLOAD FLOW

### Upload Process (S3 Pre-signed URLs)
```typescript
// Step 1: Get pre-signed URL
const response = await fetch('/api/upload/presigned-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: 'photo.jpg',
    fileType: 'image/jpeg',
    fileSize: 1024000
  })
});
const { presignedUrl, s3Key } = response.data;

// Step 2: Upload directly to S3
await fetch(presignedUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/jpeg'
  },
  body: fileBlob
});

// Step 3: Confirm upload
await fetch('/api/upload/confirm', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    s3Key,
    fileName: 'photo.jpg',
    fileSize: 1024000,
    mimeType: 'image/jpeg'
  })
});

// Use s3Key in other API calls (e.g., entryRequest.photoKey)
```

---

## 📱 UI/UX GUIDELINES

### Color Scheme (Suggested)
```css
--primary: #4F46E5;        /* Indigo */
--primary-dark: #3730A3;
--secondary: #10B981;      /* Green */
--danger: #EF4444;         /* Red */
--warning: #F59E0B;        /* Amber */
--success: #10B981;        /* Green */
--background: #F9FAFB;
--card: #FFFFFF;
--text: #111827;
--text-secondary: #6B7280;
```

### Status Colors
```css
--status-pending: #F59E0B;    /* Yellow/Amber */
--status-approved: #10B981;   /* Green */
--status-rejected: #EF4444;   /* Red */
--status-active: #3B82F6;     /* Blue */
--status-completed: #6B7280;  /* Gray */
--status-expired: #9CA3AF;    /* Light Gray */
```

### Priority Colors
```css
--priority-low: #10B981;      /* Green */
--priority-medium: #F59E0B;   /* Yellow */
--priority-high: #F97316;     /* Orange */
--priority-urgent: #EF4444;   /* Red */
--priority-critical: #DC2626; /* Dark Red */
```

### Entry Type Icons
- VISITOR: 👤 User icon
- DELIVERY: 📦 Package icon
- CAB: 🚗 Car icon
- DOMESTIC_STAFF: 🧹 Broom icon
- VENDOR: 🔧 Tool icon

### Emergency Type Icons
- MEDICAL: 🏥 Medical cross
- FIRE: 🔥 Fire icon
- THEFT: 🚨 Alert icon
- VIOLENCE: ⚠️ Warning icon
- ACCIDENT: 🚗 Crash icon

---

## 🔒 VALIDATION RULES

### Phone Number (Indian)
```typescript
// Pattern: +91XXXXXXXXXX or 0XXXXXXXXXX or XXXXXXXXXX
const phoneRegex = /^(\+91)?0?[6-9]\d{9}$/;
```

### Email
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Time Format
```typescript
// HH:MM (24-hour)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
```

### Date Validation
- `validFrom` must be before `validUntil`
- `validUntil` must be in the future
- Booking date must be within allowed advance booking days

---

## 🧪 TEST CREDENTIALS

All passwords: `password123`

| Role | Phone | Email | Notes |
|------|-------|-------|-------|
| Super Admin | +919999999999 | superadmin@societygate.com | Platform admin |
| Admin | +919876543210 | rajesh.admin@skyline.com | Skyline Residency |
| Guard | +919123456780 | - | Ramesh Singh |
| Guard | +919123456781 | - | Suresh Yadav |
| Resident | +919111111111 | amit@example.com | Flat A101, Owner |
| Resident | +919111111112 | sneha@example.com | Flat A201, Owner |
| Resident | +919111111113 | vikram@example.com | Flat A301, Tenant |

---

## 📦 RECOMMENDED LIBRARIES

### React Native
```json
{
  "dependencies": {
    "react-native": "latest",
    "@react-navigation/native": "^6.x",
    "@react-navigation/stack": "^6.x",
    "@react-navigation/bottom-tabs": "^6.x",
    "react-native-async-storage": "^1.x",
    "socket.io-client": "^4.x",
    "react-native-camera": "^4.x",
    "react-native-qrcode-scanner": "^1.x",
    "react-native-image-picker": "^5.x",
    "react-native-date-picker": "^4.x",
    "axios": "^1.x",
    "react-native-vector-icons": "^10.x",
    "react-native-svg": "^13.x"
  }
}
```

### React Web (Admin Dashboard)
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-router-dom": "^6.x",
    "axios": "^1.x",
    "socket.io-client": "^4.x",
    "@tanstack/react-query": "^5.x",
    "chart.js": "^4.x",
    "react-chartjs-2": "^5.x",
    "date-fns": "^2.x",
    "tailwindcss": "^3.x"
  }
}
```

---

## 🚀 DEVELOPMENT CHECKLIST

### Phase 1: Authentication
- [ ] Login screen (phone/email + password)
- [ ] OTP login flow
- [ ] Token storage & refresh
- [ ] Logout functionality
- [ ] Protected routes

### Phase 2: Core Features (Resident App)
- [ ] Dashboard with pending entries
- [ ] Entry approval/rejection
- [ ] Pre-approval creation with QR
- [ ] Gate pass request
- [ ] Notifications list

### Phase 3: Additional Features (Resident App)
- [ ] Amenity booking
- [ ] Complaint submission
- [ ] Emergency SOS button
- [ ] Domestic staff management
- [ ] Profile management

### Phase 4: Guard App
- [ ] Login screen
- [ ] QR scanner
- [ ] Manual entry creation
- [ ] Entry request with photo
- [ ] Checkout screen
- [ ] Today's entry log

### Phase 5: Admin Dashboard
- [ ] Dashboard with stats
- [ ] User management
- [ ] Onboarding approvals
- [ ] Gate pass management
- [ ] Notice management
- [ ] Complaint management

### Phase 6: Real-time & Polish
- [ ] Socket.IO integration
- [ ] Push notifications
- [ ] Offline support
- [ ] Error handling
- [ ] Loading states
- [ ] Empty states

---

## 📋 API ERROR HANDLING

### Standard Error Response
```typescript
{
  success: false,
  message: "Human-readable error message"
}
```

### HTTP Status Codes
- `400` - Bad Request (validation error)
- `401` - Unauthorized (token invalid/expired)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

### Error Handling Pattern
```typescript
try {
  const response = await api.post('/api/entries', data);
  if (response.data.success) {
    // Handle success
  }
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to login
  } else if (error.response?.status === 403) {
    // Show permission denied
  } else {
    // Show error message
    showToast(error.response?.data?.message || 'Something went wrong');
  }
}
```

---

## 🎯 KEY IMPLEMENTATION NOTES

1. **Society Isolation**: All data is scoped to society. Users can only see data from their society.

2. **Flat Isolation**: Residents can only manage their flat's entries, pre-approvals, etc.

3. **Auto-Approval Logic**:
   - Deliveries from pre-configured companies are auto-approved
   - Pre-approved visitors are auto-approved when QR is scanned
   - Domestic staff with active assignments are auto-approved

4. **QR Code Scanning**:
   - Pre-approvals have QR codes for visitors to show guards
   - Gate passes have QR codes for verification
   - Domestic staff have QR codes for attendance

5. **Entry Request Flow**:
   - Guard creates entry request with photo
   - Resident gets real-time notification
   - Resident approves/rejects within 15 minutes (auto-expires)
   - Entry is created automatically on approval

6. **Socket.IO Rooms**:
   - Users join room `user:{userId}` for personal notifications
   - Users join room `flat:{flatId}` for flat-specific events
   - Guards join room `society:{societyId}` for society-wide events

---

**This document is your complete guide to building the frontend. Follow the API specifications exactly and implement all features as described. Good luck! 🚀**
