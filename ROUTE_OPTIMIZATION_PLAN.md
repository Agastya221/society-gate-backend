# Route Optimization Plan

## Current Problems

### 1. Too Many Top-Level Routes (18 routes!)
```
/api/auth
/api/societies
/api/entries
/api/deliveries
/api/domestic-staff
/api/preapprovals
/api/gatepasses
/api/notices
/api/amenities
/api/complaints
/api/emergencies
/api/vendors
/api/reports
/api/onboarding
/api/upload
/api/notifications
/api/entry-requests
/api/family
```

### 2. Related Routes Are Scattered
- `/api/entries`, `/api/entry-requests`, `/api/preapprovals`, `/api/gatepasses` are all entry-related but separate
- `/api/domestic-staff`, `/api/vendors` are both service providers but separate

### 3. Redundant Prefixes
- `/api/auth/resident-app/login` + `/api/auth/guard-app/login` (app-specific duplicates)
- Many routes have `/` as the main endpoint (conflicts possible)

---

## Proposed Optimized Structure

### Group 1: Authentication & User Management
```
/api/v1/auth
  POST   /otp/send
  POST   /otp/verify
  POST   /resident/login
  POST   /guard/login
  GET    /profile
  PATCH  /profile

/api/v1/users (Admin only)
  POST   /guards
  GET    /guards
  PATCH  /:id/status
  GET    /family (Residents)
  POST   /family/invite
  DELETE /family/:id
```

### Group 2: Gate Management (All entry-related)
```
/api/v1/gate
  /entries
    POST   /          (Guard creates)
    GET    /
    GET    /pending
    GET    /today
    PATCH  /:id/approve
    PATCH  /:id/reject
    PATCH  /:id/checkout

  /requests (Entry requests with photo)
    POST   /
    GET    /
    GET    /pending
    PATCH  /:id/approve
    PATCH  /:id/reject

  /preapprovals
    POST   /
    GET    /
    GET    /active
    PATCH  /:id/cancel

  /passes
    POST   /
    GET    /
    GET    /active
    PATCH  /:id/approve
    PATCH  /:id/reject
```

### Group 3: Staff & Services
```
/api/v1/staff
  /domestic
    POST   /
    GET    /
    GET    /:id
    PATCH  /:id
    DELETE /:id
    POST   /:id/verify
    POST   /assignments
    POST   /check-in
    POST   /check-out
    POST   /qr-scan
    GET    /attendance

  /vendors
    POST   /
    GET    /
    GET    /:id
    PATCH  /:id
```

### Group 4: Community
```
/api/v1/community
  /notices
    POST   /
    GET    /
    GET    /:id
    PATCH  /:id
    DELETE /:id

  /amenities
    POST   /
    GET    /
    POST   /bookings
    GET    /bookings

  /complaints
    POST   /
    GET    /
    GET    /:id
    PATCH  /:id/status
    PATCH  /:id/assign
    PATCH  /:id/resolve

  /emergencies
    POST   /
    GET    /
    PATCH  /:id/respond
```

### Group 5: Resident Services
```
/api/v1/resident
  /onboarding
    GET    /societies
    GET    /societies/:id/blocks
    GET    /societies/:id/blocks/:blockId/flats
    POST   /request
    GET    /status

  /notifications
    GET    /
    GET    /unread
    PATCH  /:id/read
    PATCH  /mark-all-read
```

### Group 6: Admin & Reports
```
/api/v1/admin
  /societies
    POST   /
    GET    /
    GET    /:id
    PATCH  /:id
    POST   /:id/blocks
    POST   /:id/flats

  /reports
    GET    /entries
    GET    /attendance
    GET    /complaints
    GET    /amenity-bookings

  /onboarding/requests (Admin view)
    GET    /pending
    GET    /:id
    PATCH  /:id/approve
    PATCH  /:id/reject
```

### Group 7: Utilities
```
/api/v1/upload
  POST   /presigned-url
  POST   /complete
```

---

## Benefits of This Structure

### 1. Logical Grouping
- **Gate Management**: All entry-related features in one place
- **Staff**: Domestic staff + vendors together
- **Community**: Social features (notices, amenities, complaints)
- **Admin**: Administrative operations
- **Resident**: Resident-specific flows

### 2. Reduced Top-Level Routes
- **Before**: 18 routes
- **After**: 7 route groups

### 3. Better API Versioning
- `/api/v1/...` allows future `/api/v2/...` without breaking changes

### 4. Clearer Hierarchy
```
/api/v1/gate/entries          ✅ Clear
vs
/api/entries                   ❌ Ambiguous

/api/v1/staff/domestic/qr-scan ✅ Clear
vs
/api/domestic-staff/qr-scan    ❌ Redundant
```

### 5. Easier to Understand
Developer knows:
- Gate-related? → `/api/v1/gate/*`
- Staff-related? → `/api/v1/staff/*`
- Admin task? → `/api/v1/admin/*`

---

## Migration Strategy

### Option 1: Keep Both (Recommended for MVP)
```typescript
// Old routes (deprecated but working)
app.use('/api/entries', entryRoutes);
app.use('/api/domestic-staff', domesticStaffRoutes);

// New optimized routes
app.use('/api/v1/gate', gateRoutes);
app.use('/api/v1/staff', staffRoutes);
```

### Option 2: Full Migration
- Remove old routes entirely
- Update all frontend calls
- Requires coordination with frontend team

---

## Implementation Priority

### Phase 1: Create New Route Groups (No Breaking Changes)
1. Create `/api/v1/gate` router (combines entries, preapprovals, gatepasses, entry-requests)
2. Create `/api/v1/staff` router (combines domestic-staff, vendors)
3. Keep old routes active

### Phase 2: Documentation
1. Update API docs to show new routes
2. Mark old routes as deprecated
3. Provide migration guide

### Phase 3: Deprecation (After Frontend Migration)
1. Remove old route registrations
2. Clean up old route files

---

## File Structure

```
src/routes/
  ├── v1/
  │   ├── index.ts (main v1 router)
  │   ├── auth.routes.ts
  │   ├── gate.routes.ts (combines entry modules)
  │   ├── staff.routes.ts (combines staff modules)
  │   ├── community.routes.ts
  │   ├── resident.routes.ts
  │   ├── admin.routes.ts
  │   └── upload.routes.ts
  └── legacy/ (old routes - deprecated)
```

---

## Example Implementation

### Before:
```typescript
// app.ts
app.use('/api/entries', entryRoutes);
app.use('/api/entry-requests', entryRequestRoutes);
app.use('/api/preapprovals', preapprovalRoutes);
app.use('/api/gatepasses', gatepassRoutes);
```

### After:
```typescript
// app.ts
import v1Routes from './routes/v1';
app.use('/api/v1', v1Routes);

// routes/v1/index.ts
const router = Router();
router.use('/auth', authRoutes);
router.use('/gate', gateRoutes);
router.use('/staff', staffRoutes);
router.use('/community', communityRoutes);
router.use('/resident', residentRoutes);
router.use('/admin', adminRoutes);
router.use('/upload', uploadRoutes);

// routes/v1/gate.routes.ts
const router = Router();
router.use('/entries', entryRoutes);
router.use('/requests', entryRequestRoutes);
router.use('/preapprovals', preapprovalRoutes);
router.use('/passes', gatepassRoutes);
```

---

## Recommendation

**For MVP**: Implement **Phase 1 only**
- Create new optimized route structure
- Keep old routes for backward compatibility
- Update documentation

**Post-MVP**: Complete Phases 2-3
- Migrate frontend to new routes
- Deprecate and remove old routes
