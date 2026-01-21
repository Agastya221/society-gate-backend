# API v1 Migration Guide

## Overview

The backend now supports **TWO API structures**:
1. **New V1 Routes** (Optimized, Grouped) - `/api/v1/*`
2. **Legacy Routes** (Backward Compatible) - `/api/*`

Both work simultaneously, so **no breaking changes** for existing frontend code.

---

## Route Comparison

### Old (Legacy) vs New (V1)

| Old Route | New V1 Route | Category |
|-----------|--------------|----------|
| `/api/auth/*` | `/api/v1/auth/*` | Auth |
| `/api/entries/*` | `/api/v1/gate/entries/*` | Gate |
| `/api/entry-requests/*` | `/api/v1/gate/requests/*` | Gate |
| `/api/preapprovals/*` | `/api/v1/gate/preapprovals/*` | Gate |
| `/api/gatepasses/*` | `/api/v1/gate/passes/*` | Gate |
| `/api/domestic-staff/*` | `/api/v1/staff/domestic/*` | Staff |
| `/api/vendors/*` | `/api/v1/staff/vendors/*` | Staff |
| `/api/notices/*` | `/api/v1/community/notices/*` | Community |
| `/api/amenities/*` | `/api/v1/community/amenities/*` | Community |
| `/api/complaints/*` | `/api/v1/community/complaints/*` | Community |
| `/api/emergencies/*` | `/api/v1/community/emergencies/*` | Community |
| `/api/onboarding/*` | `/api/v1/resident/onboarding/*` | Resident |
| `/api/notifications/*` | `/api/v1/resident/notifications/*` | Resident |
| `/api/family/*` | `/api/v1/resident/family/*` | Resident |
| `/api/societies/*` | `/api/v1/admin/societies/*` | Admin |
| `/api/reports/*` | `/api/v1/admin/reports/*` | Admin |
| `/api/upload/*` | `/api/v1/upload/*` | Utility |
| `/api/deliveries/*` | `/api/v1/deliveries/*` | Utility |

---

## Benefits of V1 Routes

### 1. Logical Grouping
```
/api/v1/gate/*          → All entry/gate management
/api/v1/staff/*         → All staff services
/api/v1/community/*     → Social features
/api/v1/resident/*      → Resident-specific
/api/v1/admin/*         → Admin operations
```

### 2. Cleaner URLs
```
Before: /api/domestic-staff/qr-scan
After:  /api/v1/staff/domestic/qr-scan

Before: /api/entry-requests/pending
After:  /api/v1/gate/requests/pending
```

### 3. Future-Proof
- `/api/v1/*` → Current version
- `/api/v2/*` → Future version (without breaking v1)

### 4. Reduced Routes
- **Before**: 18 top-level routes
- **After**: 7 route groups

---

## Example Migrations

### Gate Management
```javascript
// OLD
POST   /api/entries
GET    /api/entries/pending
POST   /api/entry-requests
POST   /api/preapprovals
POST   /api/gatepasses

// NEW
POST   /api/v1/gate/entries
GET    /api/v1/gate/entries/pending
POST   /api/v1/gate/requests
POST   /api/v1/gate/preapprovals
POST   /api/v1/gate/passes
```

### Staff Management
```javascript
// OLD
POST   /api/domestic-staff
POST   /api/domestic-staff/qr-scan
GET    /api/vendors

// NEW
POST   /api/v1/staff/domestic
POST   /api/v1/staff/domestic/qr-scan
GET    /api/v1/staff/vendors
```

### Community Features
```javascript
// OLD
POST   /api/notices
GET    /api/amenities
POST   /api/complaints
POST   /api/emergencies

// NEW
POST   /api/v1/community/notices
GET    /api/v1/community/amenities
POST   /api/v1/community/complaints
POST   /api/v1/community/emergencies
```

### Resident Services
```javascript
// OLD
POST   /api/onboarding/request
GET    /api/notifications
POST   /api/family/invite

// NEW
POST   /api/v1/resident/onboarding/request
GET    /api/v1/resident/notifications
POST   /api/v1/resident/family/invite
```

### Admin Operations
```javascript
// OLD
GET    /api/societies
GET    /api/reports/entries
POST   /api/onboarding/admin/:id/approve

// NEW
GET    /api/v1/admin/societies
GET    /api/v1/admin/reports/entries
POST   /api/v1/resident/onboarding/admin/:id/approve
```

---

## Migration Strategy

### Phase 1: Both Routes Active (Current)
- Old routes still work ✅
- New v1 routes also work ✅
- **No action required** - choose when to migrate

### Phase 2: Gradual Migration (Recommended)
```javascript
// Update API base URL in frontend config
const API_BASE_URL = process.env.USE_V1
  ? 'https://api.example.com/api/v1'
  : 'https://api.example.com/api';

// Use feature flags to test v1 routes
if (featureFlags.useV1Routes) {
  await axios.get(`${API_BASE_URL}/gate/entries`);
} else {
  await axios.get(`${API_BASE_URL}/entries`);
}
```

### Phase 3: Full Migration
- Update all API calls to v1
- Remove legacy route imports
- Clean up old route files

---

## Code Examples

### Frontend API Service (Before)
```typescript
// api/entries.ts
export const getEntries = () => {
  return axios.get('/api/entries');
};

export const getPendingRequests = () => {
  return axios.get('/api/entry-requests/pending');
};

export const getPreApprovals = () => {
  return axios.get('/api/preapprovals');
};
```

### Frontend API Service (After - V1)
```typescript
// api/gate.ts
const BASE = '/api/v1/gate';

export const getEntries = () => {
  return axios.get(`${BASE}/entries`);
};

export const getPendingRequests = () => {
  return axios.get(`${BASE}/requests/pending`);
};

export const getPreApprovals = () => {
  return axios.get(`${BASE}/preapprovals`);
};
```

### Using Environment Variable
```typescript
// config/api.ts
export const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';
export const API_BASE = `/api${API_VERSION === 'v1' ? '/v1' : ''}`;

// api/gate.ts
import { API_BASE } from '@/config/api';

export const getEntries = () => {
  return axios.get(`${API_BASE}/gate/entries`);
};
```

---

## Testing Both Versions

### Postman/Thunder Client
```
# Old Routes
GET {{base_url}}/api/entries
GET {{base_url}}/api/domestic-staff

# New V1 Routes
GET {{base_url}}/api/v1/gate/entries
GET {{base_url}}/api/v1/staff/domestic
```

### cURL
```bash
# Old
curl http://localhost:3000/api/entries

# New V1
curl http://localhost:3000/api/v1/gate/entries
```

---

## Route Group Details

### `/api/v1/auth`
- `POST /otp/send`
- `POST /otp/verify`
- `POST /resident/login`
- `POST /guard/login`
- `GET /profile`
- `PATCH /profile`

### `/api/v1/gate`
- `/entries/*` - Entry management
- `/requests/*` - Entry requests (photo approval)
- `/preapprovals/*` - Pre-approved visitors
- `/passes/*` - Gate passes

### `/api/v1/staff`
- `/domestic/*` - Domestic staff (maids, drivers, etc.)
- `/vendors/*` - Service vendors

### `/api/v1/community`
- `/notices/*` - Society notices
- `/amenities/*` - Amenity bookings
- `/complaints/*` - Complaint system
- `/emergencies/*` - Emergency alerts

### `/api/v1/resident`
- `/onboarding/*` - Resident onboarding
- `/notifications/*` - User notifications
- `/family/*` - Family member management

### `/api/v1/admin`
- `/societies/*` - Society management
- `/reports/*` - Reports and analytics

---

## When to Migrate?

### Migrate Now If:
- ✅ Starting a new feature
- ✅ Major refactor planned
- ✅ Want cleaner, more organized code

### Wait to Migrate If:
- ⏸️ In middle of critical release
- ⏸️ Limited development resources
- ⏸️ Old routes working fine

---

## Deprecation Timeline

| Phase | Timeline | Status |
|-------|----------|--------|
| Phase 1: V1 Release | ✅ Now | Both routes active |
| Phase 2: Migration Period | 🔄 1-3 months | Gradual frontend migration |
| Phase 3: Deprecation Notice | ⏰ After migration | Mark legacy routes deprecated |
| Phase 4: Removal | 🔮 Future | Remove legacy routes |

---

## Support

Both route structures will be supported for the foreseeable future. Legacy routes will only be removed after:
1. Frontend fully migrated to v1
2. Documentation updated
3. Deprecation notices sent
4. Grace period completed

**No rush to migrate - both work perfectly!**
