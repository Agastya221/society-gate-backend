# Society Gate API Quick Reference

> Quick lookup for all API endpoints. See `FRONTEND_DEVELOPMENT_GUIDE.md` for detailed implementation guide.

## Base URL
```
http://localhost:4000
```

## Auth Header
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 🔐 Authentication

| Method | Endpoint | Auth | Body |
|--------|----------|------|------|
| POST | `/api/auth/otp/send` | ❌ | `{ phone }` |
| POST | `/api/auth/otp/verify` | ❌ | `{ phone, otp, name, email? }` |
| POST | `/api/auth/resident-app/login` | ❌ | `{ phone\|email, password }` |
| POST | `/api/auth/resident-app/register` | ❌ | `{ phone, name, password, email? }` |
| POST | `/api/auth/guard-app/login` | ❌ | `{ phone, password }` |
| GET | `/api/auth/resident-app/profile` | ✅ | - |
| PATCH | `/api/auth/resident-app/profile` | ✅ | `{ name?, email?, password? }` |
| POST | `/api/auth/resident-app/create-guard` | ✅ Admin | `{ name, phone, password }` |
| GET | `/api/auth/resident-app/guards` | ✅ Admin | - |
| PATCH | `/api/auth/resident-app/users/:id/status` | ✅ Admin | `{ isActive }` |

---

## 🚪 Entries

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/entries` | ✅ Guard | Create entry |
| GET | `/api/entries` | ✅ | List entries |
| GET | `/api/entries/today` | ✅ Guard | Today's entries |
| GET | `/api/entries/pending` | ✅ Resident | Pending approvals |
| PATCH | `/api/entries/:id/approve` | ✅ Resident | Approve entry |
| PATCH | `/api/entries/:id/reject` | ✅ Resident | Reject entry |
| PATCH | `/api/entries/:id/checkout` | ✅ Guard | Checkout visitor |

---

## 📸 Entry Requests (Guard Photo Approval)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/entry-requests` | ✅ Guard | Create with photo |
| GET | `/api/entry-requests` | ✅ | List requests |
| GET | `/api/entry-requests/pending-count` | ✅ Guard | Pending count |
| GET | `/api/entry-requests/:id/photo` | ✅ Resident | View photo |
| PATCH | `/api/entry-requests/:id/approve` | ✅ Resident | Approve |
| PATCH | `/api/entry-requests/:id/reject` | ✅ Resident | Reject |

---

## ✅ Pre-Approvals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/preapprovals` | ✅ Resident | Create pre-approval |
| GET | `/api/preapprovals` | ✅ Resident | List pre-approvals |
| GET | `/api/preapprovals/:id/qr` | ✅ Resident | Get QR code |
| DELETE | `/api/preapprovals/:id` | ✅ Resident | Cancel |
| POST | `/api/preapprovals/scan` | ✅ Guard | Scan QR |

---

## 🎫 Gate Passes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/gatepasses` | ✅ Resident | Create gate pass |
| GET | `/api/gatepasses` | ✅ | List gate passes |
| GET | `/api/gatepasses/:id` | ✅ | Get details |
| GET | `/api/gatepasses/:id/qr` | ✅ | Get QR code |
| PATCH | `/api/gatepasses/:id/approve` | ✅ Admin | Approve |
| PATCH | `/api/gatepasses/:id/reject` | ✅ Admin | Reject |
| POST | `/api/gatepasses/scan` | ✅ Guard | Scan QR |
| DELETE | `/api/gatepasses/:id` | ✅ | Cancel |

---

## 🏊 Amenities & Bookings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/amenities/amenities` | ✅ | List amenities |
| POST | `/api/amenities/amenities` | ✅ Admin | Create amenity |
| PATCH | `/api/amenities/amenities/:id` | ✅ Admin | Update amenity |
| DELETE | `/api/amenities/amenities/:id` | ✅ Admin | Delete amenity |
| POST | `/api/amenities/bookings` | ✅ Resident | Book amenity |
| GET | `/api/amenities/bookings` | ✅ | List bookings |
| PATCH | `/api/amenities/bookings/:id/approve` | ✅ Admin | Approve booking |
| PATCH | `/api/amenities/bookings/:id/cancel` | ✅ | Cancel booking |

---

## 📝 Complaints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/complaints` | ✅ Resident | Create complaint |
| GET | `/api/complaints` | ✅ | List complaints |
| GET | `/api/complaints/:id` | ✅ | Get details |
| DELETE | `/api/complaints/:id` | ✅ | Delete |
| PATCH | `/api/complaints/:id/status` | ✅ Admin | Update status |
| PATCH | `/api/complaints/:id/assign` | ✅ Admin | Assign |
| PATCH | `/api/complaints/:id/resolve` | ✅ Admin | Resolve |

---

## 🚨 Emergencies

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/emergencies` | ✅ | Create emergency |
| GET | `/api/emergencies` | ✅ Admin/Guard | List all |
| GET | `/api/emergencies/my` | ✅ Resident | My emergencies |
| GET | `/api/emergencies/active` | ✅ Admin/Guard | Active only |
| PATCH | `/api/emergencies/:id/respond` | ✅ Guard | Respond |
| PATCH | `/api/emergencies/:id/resolve` | ✅ Admin | Resolve |
| PATCH | `/api/emergencies/:id/false-alarm` | ✅ Admin | Mark false |

---

## 📢 Notices

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/notices` | ✅ Admin | Create notice |
| GET | `/api/notices` | ✅ | List notices |
| GET | `/api/notices/:id` | ✅ | Get details |
| PATCH | `/api/notices/:id` | ✅ Admin | Update |
| DELETE | `/api/notices/:id` | ✅ Admin | Delete |
| PATCH | `/api/notices/:id/toggle-pin` | ✅ Admin | Toggle pin |

---

## 👨‍🔧 Domestic Staff

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/domestic-staff` | ✅ | Add staff |
| GET | `/api/domestic-staff` | ✅ | List staff |
| GET | `/api/domestic-staff/:id` | ✅ | Get details |
| GET | `/api/domestic-staff/:id/qr` | ✅ | Get QR code |
| PATCH | `/api/domestic-staff/:id` | ✅ | Update |
| DELETE | `/api/domestic-staff/:id` | ✅ | Delete |
| PATCH | `/api/domestic-staff/:id/verify` | ✅ Admin | Verify |
| POST | `/api/domestic-staff/assignments` | ✅ | Assign to flat |
| POST | `/api/domestic-staff/check-in` | ✅ Guard | Check in |
| POST | `/api/domestic-staff/scan` | ✅ Guard | Scan QR |
| POST | `/api/domestic-staff/:staffId/check-out` | ✅ | Check out |
| GET | `/api/domestic-staff/attendance/records` | ✅ | Attendance |
| POST | `/api/domestic-staff/bookings` | ✅ Resident | Book staff |
| POST | `/api/domestic-staff/reviews` | ✅ Resident | Add review |

---

## 📦 Deliveries

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/deliveries/expected` | ✅ Resident | Add expected |
| GET | `/api/deliveries/expected` | ✅ Resident | List expected |
| POST | `/api/deliveries/auto-approve` | ✅ Resident | Add rule |
| GET | `/api/deliveries/auto-approve` | ✅ Resident | Get rules |
| DELETE | `/api/deliveries/auto-approve/:id` | ✅ Resident | Delete rule |
| GET | `/api/deliveries/companies` | ✅ | Company list |

---

## 🔔 Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications` | ✅ | List notifications |
| GET | `/api/notifications/unread-count` | ✅ | Unread count |
| PATCH | `/api/notifications/:id/read` | ✅ | Mark as read |
| PATCH | `/api/notifications/read-all` | ✅ | Mark all read |

---

## 📤 File Upload

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/upload/presigned-url` | ✅ | Get upload URL |
| POST | `/api/upload/confirm` | ✅ | Confirm upload |
| GET | `/api/upload/:id/view-url` | ✅ | Get view URL |
| DELETE | `/api/upload/:id` | ✅ | Delete file |

---

## 📊 Reports (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reports/dashboard` | ✅ Admin | Dashboard stats |
| GET | `/api/reports/entries` | ✅ Admin | Entry reports |
| GET | `/api/reports/peak-hours` | ✅ Admin | Peak hours |
| GET | `/api/reports/complaints` | ✅ Admin | Complaint stats |

---

## 🏢 Onboarding

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/onboarding/societies` | ✅ | List societies |
| GET | `/api/onboarding/societies/:id/blocks` | ✅ | List blocks |
| GET | `/api/onboarding/societies/:id/blocks/:blockId/flats` | ✅ | List flats |
| POST | `/api/onboarding/request` | ✅ | Submit request |
| GET | `/api/onboarding/status` | ✅ | Check status |
| GET | `/api/onboarding/admin/pending` | ✅ Admin | Pending requests |
| PATCH | `/api/onboarding/admin/:id/approve` | ✅ Admin | Approve |
| PATCH | `/api/onboarding/admin/:id/reject` | ✅ Admin | Reject |

---

## 🔧 Vendors

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/vendors` | ✅ Admin | Add vendor |
| GET | `/api/vendors` | ✅ | List vendors |
| GET | `/api/vendors/by-category` | ✅ | Filter by category |
| PATCH | `/api/vendors/:id/verify` | ✅ Admin | Verify |
| POST | `/api/vendors/:id/rate` | ✅ Resident | Rate vendor |

---

## 📋 ENUMS QUICK REFERENCE

### Entry Types
`VISITOR` | `DELIVERY` | `DOMESTIC_STAFF` | `CAB` | `VENDOR`

### Entry Status
`PENDING` | `APPROVED` | `REJECTED` | `CHECKED_IN` | `CHECKED_OUT`

### Visitor Types
`GUEST` | `FAMILY_MEMBER` | `FRIEND` | `DELIVERY_PERSON` | `CAB_DRIVER` | `SERVICE_PROVIDER` | `OTHER`

### Gate Pass Types
`MATERIAL` | `VEHICLE` | `MOVE_IN` | `MOVE_OUT` | `MAINTENANCE`

### Gate Pass Status
`PENDING` | `APPROVED` | `REJECTED` | `ACTIVE` | `USED` | `EXPIRED`

### Amenity Types
`CLUBHOUSE` | `GYM` | `SWIMMING_POOL` | `PARTY_HALL` | `SPORTS_COURT` | `BANQUET_HALL` | `GARDEN` | `OTHER`

### Complaint Categories
`MAINTENANCE` | `SECURITY` | `CLEANLINESS` | `WATER` | `ELECTRICITY` | `PARKING` | `NOISE` | `PETS` | `OTHER`

### Complaint Priority
`LOW` | `MEDIUM` | `HIGH` | `URGENT`

### Complaint Status
`OPEN` | `IN_PROGRESS` | `RESOLVED` | `CLOSED` | `REJECTED`

### Emergency Types
`MEDICAL` | `FIRE` | `THEFT` | `VIOLENCE` | `ACCIDENT` | `OTHER`

### Emergency Status
`ACTIVE` | `RESOLVED` | `FALSE_ALARM`

### Notice Types
`GENERAL` | `URGENT` | `EVENT` | `MAINTENANCE` | `MEETING` | `EMERGENCY`

### Notice Priority
`LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

### Staff Types
`MAID` | `COOK` | `NANNY` | `DRIVER` | `CLEANER` | `GARDENER` | `LAUNDRY` | `CARETAKER` | `SECURITY_GUARD` | `OTHER`

### Provider Tags (Delivery)
`BLINKIT` | `SWIGGY` | `ZOMATO` | `AMAZON` | `FLIPKART` | `BIGBASKET` | `DUNZO` | `OTHER`

### Notification Types
`ONBOARDING_STATUS` | `ENTRY_REQUEST` | `DELIVERY_REQUEST` | `EMERGENCY_ALERT` | `SYSTEM`

---

## 🧪 Test Accounts

| Role | Phone | Password |
|------|-------|----------|
| Super Admin | +919999999999 | password123 |
| Admin | +919876543210 | password123 |
| Guard | +919123456780 | password123 |
| Resident | +919111111111 | password123 |

---

## 🔌 Socket.IO Events

```typescript
// Listen for:
'entry:pending'      // New entry awaiting approval
'entry:approved'     // Entry was approved
'entry:rejected'     // Entry was rejected
'notification'       // New notification
'emergency:alert'    // Emergency alert
'complaint:status-updated'  // Complaint status change
```
