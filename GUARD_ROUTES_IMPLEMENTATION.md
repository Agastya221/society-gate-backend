# Guard Routes Implementation

## Overview
Created dedicated Guard routes under `/api/v1/guard/*` to provide a centralized endpoint for all guard-specific operations.

---

## Changes Made

### 1. Created Guard Routes File

**File:** [src/routes/v1/guard.routes.ts](src/routes/v1/guard.routes.ts)

All routes under `/api/v1/guard/*` require guard authentication via `authenticateGuardApp` middleware.

#### Available Endpoints:

**Dashboard / Home:**
- `GET /api/v1/guard/today` - Get today's entries for guard dashboard
- `GET /api/v1/guard/pending-count` - Get pending entry request count

**Entry Management:**
- `POST /api/v1/guard/entries` - Create new entry
- `PATCH /api/v1/guard/entries/:id/checkout` - Checkout entry
- `GET /api/v1/guard/entries` - Get all entries (filtered for guard's society)

**Entry Requests (Visitor at Gate):**
- `POST /api/v1/guard/entry-requests` - Create entry request with photo

**QR Scanning:**
- `POST /api/v1/guard/scan/preapproval` - Scan pre-approval QR code
- `POST /api/v1/guard/scan/gatepass` - Scan gate pass QR code
- `POST /api/v1/guard/scan/staff` - Scan domestic staff QR code

---

### 2. Updated Route Registration

**File:** [src/routes/v1/index.ts](src/routes/v1/index.ts)

Added guard routes to the v1 router:

```typescript
import guardRoutes from './guard.routes';

router.use('/guard', guardRoutes);  // /api/v1/guard/*
```

---

### 3. Fixed Delivery Routes Comment

**File:** [src/routes/v1/index.ts](src/routes/v1/index.ts:21)

**Before:**
```typescript
router.use('/deliveries', deliveryRoutes);    // /api/v1/deliveries (Guard-specific)
```

**After:**
```typescript
router.use('/deliveries', deliveryRoutes);    // /api/v1/deliveries (Resident delivery preferences)
```

The deliveries route is for residents to manage their delivery preferences, not guard-specific.

---

## Guard Authentication

All guard routes use `authenticateGuardApp` middleware which:

1. Validates JWT token
2. Ensures user has `GUARD` role
3. Verifies guard is assigned to a society
4. Blocks access for other roles (RESIDENT, ADMIN, SUPER_ADMIN)

**Implementation:** [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts:256-285)

---

## Guard Workflow

### Entry Creation Flow
```
1. Guard scans pre-approval QR OR creates manual entry
2. POST /api/v1/guard/entries (or scan endpoints)
3. Entry created with PENDING status
4. Resident approves/rejects via their app
5. Guard can checkout visitor when leaving
```

### Entry Request Flow (Photo Approval)
```
1. Visitor arrives without pre-approval
2. Guard takes photo
3. POST /api/v1/guard/entry-requests
4. Resident receives notification with photo
5. Resident approves/rejects
6. If approved, entry is created automatically
```

### QR Scanning Flow
```
1. Visitor shows QR code
2. Guard scans via app
3. POST /api/v1/guard/scan/{type}
4. System validates and auto-approves if valid
5. Entry created with APPROVED status
```

---

## Integration with Existing Routes

Guard routes provide a **centralized interface** but use existing controllers:

- **Entry Management** → Uses `EntryController`
- **Entry Requests** → Uses entry-request controllers
- **Pre-approvals** → Uses `PreApprovalController`
- **Gate Passes** → Uses gatepass controllers
- **Staff Check-in** → Uses domestic-staff controllers

This approach:
- ✅ Maintains single source of truth for business logic
- ✅ Provides guard-specific endpoint grouping
- ✅ Simplifies guard app development
- ✅ Keeps controllers DRY (Don't Repeat Yourself)

---

## Guard Dashboard Data

**Endpoint:** `GET /api/v1/guard/today`

Returns today's entries for the guard's assigned society:

```json
{
  "success": true,
  "data": [
    {
      "id": "entry-id",
      "type": "VISITOR",
      "visitorName": "John Doe",
      "visitorPhone": "+919876543210",
      "status": "PENDING",
      "flatNumber": "A-101",
      "checkInTime": "2026-01-24T10:30:00Z",
      "checkOutTime": null
    }
  ]
}
```

**Endpoint:** `GET /api/v1/guard/pending-count`

Returns count of pending entry requests:

```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

---

## API Structure Overview

```
/api/v1/
├── auth/           # Authentication (login, OTP, logout, refresh)
├── guard/          # Guard-specific operations ⭐ NEW
├── resident/       # Resident-specific operations
├── admin/          # Admin-specific operations
├── gate/           # Society gate operations (cross-role)
├── staff/          # Domestic staff operations (cross-role)
├── community/      # Community features (cross-role)
└── upload/         # File upload operations
```

---

## Testing

### Server Status
- ✅ TypeScript compilation successful
- ✅ Server starts without errors
- ✅ Guard routes registered at `/api/v1/guard/*`
- ✅ Authentication middleware properly applied

### Manual Testing Commands

#### Guard Login
```bash
curl -X POST http://localhost:4000/api/v1/auth/guard-app/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "password": "guard-password"
  }'
```

#### Get Today's Entries
```bash
curl http://localhost:4000/api/v1/guard/today \
  -H "Authorization: Bearer GUARD_ACCESS_TOKEN"
```

#### Create Entry
```bash
curl -X POST http://localhost:4000/api/v1/guard/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer GUARD_ACCESS_TOKEN" \
  -d '{
    "type": "VISITOR",
    "visitorName": "John Doe",
    "visitorPhone": "+919999999999",
    "flatId": "flat-uuid",
    "purpose": "Meeting"
  }'
```

#### Scan Pre-approval QR
```bash
curl -X POST http://localhost:4000/api/v1/guard/scan/preapproval \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer GUARD_ACCESS_TOKEN" \
  -d '{
    "qrToken": "unique-qr-token"
  }'
```

---

## Benefits

### For Guards
1. **Single Endpoint Prefix** - All guard operations under `/api/v1/guard/*`
2. **Simplified Navigation** - Easy to find guard-specific endpoints
3. **Consistent Auth** - Same authentication for all operations
4. **Better UX** - Clear API structure for mobile app development

### For Developers
1. **Clear Separation** - Guard operations clearly grouped
2. **Easy Maintenance** - Single file for guard route definitions
3. **Role-Based Routing** - Each role has dedicated route file
4. **Scalability** - Easy to add new guard features

### For Security
1. **Centralized Auth** - Guard authentication applied at router level
2. **Role Isolation** - Guards can't access admin/resident endpoints
3. **Society Isolation** - Guards only see data from their society
4. **Clear Permissions** - Easy to audit guard capabilities

---

## Files Modified

1. ✅ [src/routes/v1/guard.routes.ts](src/routes/v1/guard.routes.ts) - **NEW** Guard routes
2. ✅ [src/routes/v1/index.ts](src/routes/v1/index.ts) - Added guard route registration
3. ✅ Fixed delivery routes comment

---

## Next Steps

### Recommended Enhancements

1. **Add Guard Statistics**
   - Total entries created today
   - Average check-in time
   - Most active gate points

2. **Guard Notifications**
   - Alert when visitor denied by resident
   - Notify when pre-approval QR scanned successfully

3. **Guard Reports**
   - Daily entry summary
   - Visitor frequency analysis
   - Gate activity logs

4. **Offline Support**
   - Queue entry requests when offline
   - Sync when connection restored

---

## Migration Notes

If you had any direct guard-specific routes elsewhere, they should now use:
- ❌ Old: `/api/v1/admin/entries` (guards accessing admin routes)
- ✅ New: `/api/v1/guard/entries` (dedicated guard routes)

---

**Last Updated:** 2026-01-24
**Version:** 2.0
