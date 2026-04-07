# Society Gate — V2 Roadmap

Features deferred from V1 to keep the initial release clean and focused.
Each section documents what's needed, why it was deferred, and what backend changes are required.

---

## 1. Service Provider App (Maid, Laundry, Cook, Driver, etc.)

### What it is
A self-serve mobile app for domestic staff (maids, cooks, laundry workers, drivers, etc.) where they can:
- Log in with their phone number
- See which flats they are assigned to
- View and accept/reject booking requests from residents
- Mark attendance (check-in / check-out per flat)
- See their earnings and payment history
- Receive push notifications for new bookings

### Why deferred
V1 treats `DomesticStaff` as a society-managed record — admins add them, residents book them.
The staff themselves have no login. Adding self-serve login requires a schema change that touches
multiple models and flows, which would complicate the V1 release.

### What already exists (no changes needed)
- `DomesticStaff` model with: QR token, working days, hourly/daily/monthly rates, multi-flat assignments, reviews, check-in/check-out tracking, ID proof, verification status
- Staff types already defined: `MAID`, `COOK`, `NANNY`, `DRIVER`, `CLEANER`, `GARDENER`, `LAUNDRY`, `CARETAKER`, `SECURITY_GUARD`, `OTHER`
- `StaffFlatAssignment` — staff can be assigned to multiple flats
- `StaffAttendance` — per-flat check-in/check-out records
- `StaffBooking` — residents can book staff for specific time slots
- `StaffReview` — residents can rate and review staff

### Schema changes required for V2

**Option A — Link DomesticStaff to a User account (recommended)**

Add a `userId` field to `DomesticStaff`:
```prisma
model DomesticStaff {
  ...
  userId String? @unique  // nullable — existing staff without accounts
  user   User?   @relation(fields: [userId], references: [id])
  fcmToken String?         // for push notifications
}
```

Add `DOMESTIC_STAFF` to the `Role` enum:
```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  GUARD
  RESIDENT
  DOMESTIC_STAFF  // new
}
```

**Option B — Separate auth flow (simpler but duplicates logic)**
Keep `DomesticStaff` separate, add phone-based OTP login that returns a staff-specific token.
Less clean but avoids touching the Role enum and all role-based middleware.

**Recommendation: Option A** — reuses existing OTP login infrastructure cleanly.

### New endpoints needed
```
POST /staff-app/otp/verify          — login with phone (creates User if new)
GET  /staff-app/profile             — staff profile + assigned flats
GET  /staff-app/bookings            — incoming booking requests
PATCH /staff-app/bookings/:id/accept
PATCH /staff-app/bookings/:id/reject
POST /staff-app/attendance/check-in
POST /staff-app/attendance/check-out
GET  /staff-app/earnings            — payment history
PATCH /staff-app/fcm-token          — register push token
```

### Guard app impact
Guard already scans staff QR at gate. No changes needed there — the `qrToken` on `DomesticStaff` handles entry independently of the User login.

### Estimated scope
- Schema migration: ~1 day
- Auth + profile endpoints: ~1 day
- Booking accept/reject + notifications: ~1 day
- Attendance + earnings: ~1 day
- **Total: ~4 days backend**

---

## 2. (Add future V2 features here)

---

*Last updated: 2026-04-07*
