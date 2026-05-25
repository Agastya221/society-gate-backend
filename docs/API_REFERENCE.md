# Society Gate Backend API Reference

Generated from the live TypeScript source on 2026-05-23. This document intentionally does not rely on `docs/API_DOCUMENTATION.md`.

## Base URL

- Local default: `http://localhost:5000`
- API base: `/api/v1`
- Most endpoints return JSON shaped like:

```json
{
  "success": true,
  "message": "Optional message",
  "data": {}
}
```

Validation errors usually return:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["field: reason"]
}
```

## Auth Rules

Send JWTs as:

```http
Authorization: Bearer <accessToken>
```

Auth labels used below:

| Label | Meaning |
| --- | --- |
| Public | No JWT required. |
| Auth | Any active authenticated user. |
| Onboarding auth | Authenticated user, including inactive/pre-approval users. |
| Resident app | `RESIDENT`, `ADMIN`, or `SUPER_ADMIN`; `RESIDENT` must have a flat assigned. |
| Guard app | `GUARD` only. |
| Admin | `ADMIN` or `SUPER_ADMIN`. |
| Super admin | `SUPER_ADMIN` only. |
| Same society | Non-super-admin users are restricted to their own `societyId`; middleware injects `societyId` into non-GET bodies and GET queries when missing. |

Global limits:

- `/api/*`: 200 requests per 15 minutes.
- `/api/v1/auth/*`: 30 requests per 15 minutes.
- Party invite claim endpoint: 5 attempts per hour per IP.

## Public System Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Text health message: `Society Gate API is running`. |
| `GET` | `/health` | API, database, and Redis health check. |

## Auth And User Endpoints

The same router is mounted at both `/api/v1/auth` and `/api/v1/users`. Prefer `/auth` for login/token flows and `/users` for profile/user flows, but both currently expose the same paths.

Use `{authBase}` as either `/api/v1/auth` or `/api/v1/users`.

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `{authBase}/bootstrap-superadmin` | Public | `BootstrapSuperAdmin` | Create first super admin using bootstrap secret. |
| `POST` | `{authBase}/otp/verify` | Public | `ResidentWidgetVerify` | Verify MSG91 resident widget token; creates resident user on first login. |
| `POST` | `{authBase}/admin-app/otp/verify` | Public | `WidgetVerify` | Verify MSG91 widget token for existing admin/resident users. |
| `POST` | `{authBase}/guard-app/otp/verify` | Public | `WidgetVerify` | Verify MSG91 widget token for guard users. |
| `POST` | `{authBase}/refresh-token` | Public | `RefreshToken` | Get a new access token. |
| `POST` | `{authBase}/logout` | Auth | None | Blacklist current token / logout. |
| `GET` | `{authBase}/resident-app/profile` | Resident app | None | Current user profile. |
| `GET` | `{authBase}/resident-app/contexts` | Onboarding auth | None | All society/flat memberships the user can switch into. |
| `POST` | `{authBase}/resident-app/switch-context` | Resident app | `SwitchContext` | Switch active membership context. |
| `PATCH` | `{authBase}/resident-app/profile` | Resident app | `UpdateProfile` | Update current profile. |
| `POST` | `{authBase}/resident-app/create-guard` | Admin | `CreateGuard` | Create a guard user for the society. |
| `GET` | `{authBase}/resident-app/guards` | Admin | None | List guards in the society. |
| `GET` | `{authBase}/resident-app/settings-summary` | Onboarding auth | None | Resident settings summary. |
| `PATCH` | `{authBase}/resident-app/fcm-token` | Onboarding auth | `FcmToken` | Save resident app FCM token. |
| `PATCH` | `{authBase}/resident-app/users/:id/status` | Admin | `ToggleUserStatus` | Activate/deactivate a user. |
| `GET` | `{authBase}/guard-app/profile` | Guard app | None | Current guard profile. |
| `PATCH` | `{authBase}/guard-app/fcm-token` | Guard app | `FcmToken` | Save guard app FCM token. |

## Society Registration

Base: `/api/v1/society-registration`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/request` | Onboarding auth, resident roles | `SubmitSocietyRegistration` | Resident requests creation of a new society. |
| `GET` | `/my-status` | Onboarding auth, resident roles | None | Current user's society registration request status. |
| `GET` | `/requests` | Super admin | Query: `status`, `page`, `limit` | List society registration requests. |
| `GET` | `/requests/:id` | Super admin | None | Get request details. |
| `POST` | `/requests/:id/approve` | Super admin | None | Approve request and create society/admin membership. |
| `POST` | `/requests/:id/reject` | Super admin | `RejectSocietyRegistration` | Reject request. |

## Payments

Base: `/api/v1/payments`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/cashfree/webhook` | Public | Cashfree webhook body | Cashfree payment webhook. Uses raw body captured by Express JSON middleware. |
| `POST` | `/invoices/:invoiceId/cashfree/order` | Auth | `CreateCashfreeOrder` | Create Cashfree order for an invoice. |
| `GET` | `/invoices/:invoiceId/cashfree/status` | Auth | Query: `sync=true\|false` | Get invoice Cashfree payment status; optional provider sync. |

## Admin Endpoints

All paths below are under `/api/v1/admin`.

### Admin: Societies

Base: `/api/v1/admin/societies`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Super admin | `CreateSociety` | Create society, default gate, and admin office flat. |
| `GET` | `/` | Super admin | Query: `city`, `isActive`, `page`, `limit` | List societies. |
| `POST` | `/:id/blocks` | Admin | `CreateBlock` | Create block/tower in society. |
| `POST` | `/:id/flats` | Admin | `CreateFlat` | Create flat; creates block by name if missing. |
| `PATCH` | `/:id/flats/:flatId` | Admin | `UpdateFlat` | Update flat. |
| `DELETE` | `/:id/flats/:flatId` | Admin | None | Deactivate flat. |
| `PATCH` | `/:id/payment-paid` | Super admin | None | Mark society subscription paid. |
| `GET` | `/:id` | Admin | None | Get society details. |
| `PATCH` | `/:id` | Admin | `UpdateSociety` | Update society. |
| `GET` | `/:id/stats` | Admin | None | Society stats summary. |

### Admin: Reports

Base: `/api/v1/admin/reports`

| Method | Path | Auth | Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/dashboard` | Admin | `societyId?` | Dashboard stats. |
| `GET` | `/entries` | Admin | `societyId?`, `days?` default 7 | Entry statistics. |
| `GET` | `/peak-hours` | Admin | `societyId?`, `days?` default 30 | Peak entry hours. |
| `GET` | `/delivery-patterns` | Admin | `societyId?`, `days?` default 30 | Delivery provider patterns. |
| `GET` | `/complaints` | Admin | `societyId?` | Complaint statistics. |
| `GET` | `/visitor-frequency` | Admin | `societyId?` | Frequent visitor report. |
| `GET` | `/health-score` | Admin | `societyId?` | Society health score. |

### Admin: Billing

Base: `/api/v1/admin/billing`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/generate` | Admin | `GenerateInvoices` | Bulk generate invoices. |
| `POST` | `/penalty` | Admin | `Penalty` | Apply late fee to overdue invoices. |
| `GET` | `/dues` | Admin | `BillingListQuery` | List society invoices. |
| `PATCH` | `/invoices/:id/paid` | Admin | None | Mark invoice paid. |
| `PATCH` | `/invoices/:id/waive` | Admin | None | Waive invoice. |
| `POST` | `/invoices/:id/reminder` | Admin | None | Send invoice reminder. |

Alias:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/dues` | Admin | Same as `/api/v1/admin/billing/dues`. |

### Admin: Notifications, Broadcast, Staff, Intercom

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/admin/notifications` | Admin | `page`, `limit`, `unreadOnly`, `type`, `category` | List admin notifications. |
| `GET` | `/api/v1/admin/notifications/unread-count` | Admin | None | Unread admin notification count. |
| `GET` | `/api/v1/admin/notifications/stats` | Admin | None | Notification stats by category/type. |
| `PATCH` | `/api/v1/admin/notifications/:id/read` | Admin | None | Mark one admin notification read. |
| `PATCH` | `/api/v1/admin/notifications/read-all` | Admin | None | Mark all admin notifications read. |
| `DELETE` | `/api/v1/admin/notifications/:id` | Admin | None | Delete admin notification. |
| `POST` | `/api/v1/admin/broadcast` | Admin | `Broadcast` | Send broadcast notice/notification. |
| `GET` | `/api/v1/admin/broadcast` | Admin | `page`, `limit` | Broadcast history. |
| `GET` | `/api/v1/admin/staff` | Admin | None | Unified staff directory. |
| `GET` | `/api/v1/admin/staff/attendance` | Admin | `date`, `staffId`, `page`, `limit` | Staff attendance for admin panel. |
| `GET` | `/api/v1/admin/intercom/contacts` | Admin | `societyId?`, `search?`, `page`, `limit`, `includeGuards`, `includeInactive` | Resident/guard intercom contacts. |

### Admin: Parking And Pre-Approved Oversight

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/admin/parking/lookup` | Admin | Query: `q` | Lookup vehicle by plate/name fragment. |
| `GET` | `/api/v1/admin/parking/violations` | Admin | `ParkingViolationQuery` | List violations/complaints. |
| `POST` | `/api/v1/admin/parking/violations` | Admin | `IssueParkingViolation` | Issue official parking violation. |
| `POST` | `/api/v1/admin/parking/vehicles/:vehicleId/violations` | Admin | `IssueParkingViolationForVehicle` | Issue official violation for existing vehicle. |
| `PATCH` | `/api/v1/admin/parking/violations/:id/resolve` | Admin | `ResolveParkingViolation` | Resolve or dismiss violation. |
| `GET` | `/api/v1/admin/pre-approved` | Admin | `AdminPreApprovedQuery` | List all pre-approved entries for society/admin. |
| `PATCH` | `/api/v1/admin/pre-approved/:id/cancel` | Admin | `AdminCancelEntry` | Admin cancel pre-approved entry. |

## Resident Endpoints

All paths below are under `/api/v1/resident`.

### Resident: Onboarding

Base: `/api/v1/resident/onboarding`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/societies` | Onboarding auth | `city`, `search` | List societies for onboarding. |
| `GET` | `/societies/:societyId/blocks` | Onboarding auth | None | List blocks in society. |
| `GET` | `/societies/:societyId/blocks/:blockId/flats` | Onboarding auth | None | List flats in block. |
| `POST` | `/request` | Onboarding auth | `SubmitOnboardingRequest` | Submit resident onboarding request. |
| `GET` | `/status` | Onboarding auth | None | Current user's onboarding status. |
| `GET` | `/admin/pending` | Admin via resident app | `status`, `residentType`, `page`, `limit` | Pending onboarding requests for admin's society. |
| `GET` | `/admin/:requestId` | Admin via resident app | None | Onboarding request details. |
| `PATCH` | `/admin/:requestId/approve` | Admin via resident app | `{ "notes"?: string }` | Approve onboarding request. |
| `PATCH` | `/admin/:requestId/reject` | Admin via resident app | `{ "reason": string }` | Reject onboarding request. |
| `PATCH` | `/admin/:requestId/request-resubmit` | Admin via resident app | `{ "reason": string, "documentsToResubmit"?: string[] }` | Ask resident to resubmit docs. |

### Resident: Notifications, Family, Dues, Parking Complaints

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/resident/notifications` | Auth + same society | `page`, `limit`, `unreadOnly` | List current user's notifications. |
| `GET` | `/api/v1/resident/notifications/unread-count` | Auth + same society | None | Unread count. |
| `PATCH` | `/api/v1/resident/notifications/read-all` | Auth + same society | None | Mark all read. |
| `PATCH` | `/api/v1/resident/notifications/:id/read` | Auth + same society | None | Mark one read. |
| `POST` | `/api/v1/resident/family/add` | Resident app | `FamilyMember` | Add family member. |
| `POST` | `/api/v1/resident/family/invite` | Resident app | `FamilyMember` | Alias for add family member. |
| `GET` | `/api/v1/resident/family` | Resident app | None | List family members in user's flat. |
| `DELETE` | `/api/v1/resident/family/:memberId` | Resident app | None | Remove family member. |
| `PATCH` | `/api/v1/resident/family/:memberId/role` | Resident app | `UpdateFamilyRole` | Update family role. |
| `GET` | `/api/v1/resident/dues` | Auth | None | Current flat invoices. |
| `GET` | `/api/v1/resident/dues/:id` | Auth | None | Current flat invoice details. |
| `GET` | `/api/v1/resident/society-dues` | Auth | None | Society subscription/payment reminders. |
| `POST` | `/api/v1/resident/parking/complaints` | Auth | `ParkingComplaint` | File resident parking complaint. |
| `GET` | `/api/v1/resident/parking/complaints` | Auth | `ParkingViolationQuery` | List resident-visible parking complaints/violations. |

## Gate Endpoints

All paths below are under `/api/v1/gate`.

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/entries` | Auth + same society | `EntryLogQuery` | Entry log; residents flat-scoped, guards/admins society-scoped. |
| `GET` | `/parking/lookup` | Auth + same society | Query: `q` | Lookup vehicle. |
| `GET` | `/parking/violations` | Auth + same society | `ParkingViolationQuery` | List parking violations. |
| `POST` | `/parking/violations` | Auth + same society | `IssueParkingViolation` | Issue official violation. |
| `POST` | `/parking/vehicles/:vehicleId/violations` | Auth + same society | `IssueParkingViolationForVehicle` | Issue violation for a known vehicle. |
| `GET` | `/flats/search` | Auth + same society | Query: `query` | Search occupied flats for guard entry screen. |

Entry request router is mounted at both `/api/v1/gate/requests` and `/api/v1/gate/entry-requests`.

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Guard | `CreateEntryRequest` | Guard creates manual visitor/delivery request. |
| `GET` | `/pending-count` | Guard | None | Guard pending count. |
| `GET` | `/` | Auth + same society | `EntryRequestQuery` | List entry requests. |
| `GET` | `/:id` | Auth + same society | None | Entry request details. |
| `GET` | `/:id/photo` | Resident/Admin/Super admin | None | Entry request photo view URL. |
| `PATCH` | `/:id/approve` | Resident/Admin/Super admin | None | Approve entry request. |
| `PATCH` | `/:id/reject` | Resident/Admin/Super admin | `{ "reason"?: string }` | Reject entry request. |

### Gate Passes

Base: `/api/v1/gate/passes`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Resident/Admin/Super admin | `CreateGatePass` | Create material/vehicle/move gate pass. |
| `GET` | `/` | Auth + same society | `GatePassQuery` | List gate passes. |
| `POST` | `/scan` | Guard | `{ "qrToken": string }` | Legacy gate pass QR scan. |
| `GET` | `/:id` | Auth + same society | None | Gate pass details. |
| `GET` | `/:id/qr` | Auth + same society | None | Gate pass QR payload/image data. |
| `PATCH` | `/:id/approve` | Admin | None | Approve gate pass. |
| `PATCH` | `/:id/reject` | Admin | `{ "reason"?: string }` | Reject gate pass. |
| `DELETE` | `/:id` | Auth + same society | None | Cancel gate pass. |

### Guest And Party Invites

Base: `/api/v1/gate/invites/guest`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Auth + same society | `CreateGuestInvite` | Create quick/frequent/private guest invite. |
| `GET` | `/` | Auth + same society | `status`, `type` | List guest invites for user. |
| `GET` | `/:id` | Auth + same society | None | Guest invite details. |
| `PATCH` | `/:id/revoke` | Auth + same society | None | Revoke invite. |
| `DELETE` | `/:id` | Auth + same society | None | Delete invite. |

Base: `/api/v1/gate/invites/party`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/:inviteCode/claim` | Public | `ClaimPartySlot` | Guest claims a party invite slot. |
| `POST` | `/` | Auth + same society | `CreatePartyInvite` | Create party invite. |
| `GET` | `/` | Auth + same society | None | List party invites. |
| `GET` | `/:id` | Auth + same society | None | Party invite details. |
| `POST` | `/:id/add-guest` | Auth + same society | `AddPartyGuest` | Add named guest to party invite. |
| `DELETE` | `/:id/guests/:code` | Auth + same society | None | Remove party guest. |
| `PATCH` | `/:id/cancel` | Auth + same society | None | Cancel party invite. |

### Pre-Approved Entries

Base: `/api/v1/gate/pre-approved`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Auth + same society | `CreatePreApprovedEntry` | Create cab/delivery/help pre-approved entry. |
| `GET` | `/` | Auth + same society | `PreApprovedQuery` | List user's pre-approved entries. |
| `GET` | `/:id` | Auth + same society | None | Get entry details. |
| `PATCH` | `/:id` | Auth + same society | `UpdatePreApprovedEntry` | Update entry. |
| `PATCH` | `/:id/cancel` | Auth + same society | None | Cancel entry. |
| `DELETE` | `/:id` | Auth + same society | None | Delete entry. |
| `GET` | `/:id/repeat` | Auth + same society | None | Get repeat template. |
| `GET` | `/:id/usages` | Auth + same society | `page`, `limit` | Usage history. |

## Guard App Endpoints

Base: `/api/v1/guard`. All routes require guard app auth.

| Method | Path | Body / Query | Purpose |
| --- | --- | --- | --- |
| `GET` | `/today` | None | Today's entries and dashboard data. |
| `GET` | `/pending-count` | None | Pending entry request count. |
| `PATCH` | `/entries/:id/checkout` | None | Check out visitor/entry. |
| `GET` | `/entries` | `EntryLogQuery` | List entries. |
| `POST` | `/entry-requests` | `CreateEntryRequest` | Create manual entry request. |
| `POST` | `/scan` | `ScanQr` | Unified QR scan for gate pass/staff/invites. |
| `POST` | `/scan/gatepass` | `{ "qrToken": string }` | Legacy gate pass scan. |
| `POST` | `/scan/staff` | `{ "qrToken": string, "flatId": string, "societyId": string }` | Legacy staff scan/check-in-out. |
| `POST` | `/verify-code` | `VerifyCode` | Verify guest/party invite passcode. |
| `GET` | `/entry-log` | `page`, `limit` | Gate entry log. |
| `POST` | `/pre-approved/validate` | `ValidatePreApprovedEntry` | Validate cab/delivery/help pre-approval. |
| `POST` | `/pre-approved/:id/use` | `MarkPreApprovedUsed` | Mark pre-approved entry used. |
| `GET` | `/pre-approved` | `PreApprovedQuery` | List pre-approved entries visible to guard. |
| `GET` | `/pre-approved/search` | `q` | Search pre-approved entries. |
| `GET` | `/emergencies/active` | None | Active emergencies. |
| `PATCH` | `/emergencies/:id/respond` | None | Mark guard/admin response to emergency. |

## Community Module Endpoints

Notices, amenities, complaints, and emergencies are mounted under `/api/v1/community`.

### Community Notices

Base: `/api/v1/community/notices`. Same endpoint set as resident/admin notices.

See "Reusable Module Endpoints" for the notices table.

### Community Amenities

Base: `/api/v1/community/amenities`. Same endpoint set as resident amenities.

See "Reusable Module Endpoints" for the amenities table.

### Community Complaints

Base: `/api/v1/community/complaints`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `ComplaintQuery` | List complaints. |
| `GET` | `/:id` | Auth + same society | None | Complaint details. |
| `POST` | `/` | Resident/Admin/Super admin | `CreateComplaint` | Create complaint. |
| `DELETE` | `/:id` | Auth + same society | None | Delete complaint. |
| `PATCH` | `/:id/status` | Admin | `UpdateComplaintStatus` | Update complaint status. |
| `PATCH` | `/:id/assign` | Admin | `AssignComplaint` | Assign complaint. |
| `PATCH` | `/:id/resolve` | Admin | `ResolveComplaint` | Resolve complaint. |

### Community Emergencies

Base: `/api/v1/community/emergencies`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/` | Auth + same society | `CreateEmergency` | Create emergency alert. |
| `GET` | `/my` | Auth + same society | None | Current user's emergencies. |
| `GET` | `/active` | Resident/Admin/Super admin/Guard | None | Active emergencies. |
| `GET` | `/` | Resident/Admin/Super admin/Guard | `EmergencyQuery` | List emergencies. |
| `GET` | `/:id` | Resident/Admin/Super admin/Guard | None | Emergency details. |
| `PATCH` | `/:id/respond` | Admin/Guard | None | Respond to emergency. |
| `PATCH` | `/:id/resolve` | Admin/Guard | `ResolveEmergency` | Resolve emergency. |
| `PATCH` | `/:id/false-alarm` | Auth + same society | `ResolveEmergency` | Mark false alarm; service checks reporter/admin. |

## Staff Endpoints

### Domestic Staff

Domestic staff router is mounted at both:

- `/api/v1/staff/domestic`
- `/api/v1/resident/daily-help`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `StaffQuery` | List domestic staff. |
| `GET` | `/available` | Auth + same society | `staffType`, `bookingDate`, `startTime`, `endTime` | Available staff. |
| `GET` | `/types` | Auth + same society | None | Count by staff type. |
| `POST` | `/` | Resident/Admin/Super admin | `CreateStaff` | Create domestic staff profile. |
| `POST` | `/assignments` | Resident/Admin/Super admin | `CreateStaffAssignment` | Assign staff to flat. |
| `PATCH` | `/assignments/:id` | Resident/Admin/Super admin | `UpdateStaffAssignment` | Update assignment. |
| `DELETE` | `/assignments/:id` | Resident/Admin/Super admin | None | Remove assignment. |
| `POST` | `/check-in` | Guard/Resident | `StaffCheckIn` | Staff check-in. |
| `POST` | `/scan` | Guard/Resident | `StaffScanQr` | Scan staff QR; toggles check-in/check-out. |
| `GET` | `/attendance/records` | Auth + same society | `AttendanceQuery` | Attendance records. |
| `POST` | `/bookings` | Resident/Admin/Super admin | `CreateStaffBooking` | Book staff. |
| `GET` | `/bookings/list` | Auth + same society | `StaffBookingQuery` | List staff bookings. |
| `PATCH` | `/bookings/:id/accept` | Resident/Admin/Super admin | None | Accept booking. |
| `PATCH` | `/bookings/:id/reject` | Resident/Admin/Super admin | `{ "rejectionReason"?: string }` | Reject booking. |
| `PATCH` | `/bookings/:id/complete` | Resident/Admin/Super admin | `{ "actualDuration"?: number, "finalCost"?: number }` | Complete booking. |
| `POST` | `/reviews` | Resident/Admin/Super admin | `CreateStaffReview` | Add staff review. |
| `GET` | `/:id` | Auth + same society | None | Staff details. |
| `GET` | `/:id/qr` | Auth + same society | None | Staff QR payload/image data. |
| `PATCH` | `/:id` | Resident/Admin/Super admin | `UpdateStaff` | Update staff. |
| `DELETE` | `/:id` | Resident/Admin/Super admin | None | Deactivate staff. |
| `PATCH` | `/:id/verify` | Admin | None | Toggle verification. |
| `PATCH` | `/:id/availability` | Resident/Admin/Super admin | `{ "status": StaffAvailabilityStatus }` | Update availability. |
| `GET` | `/:staffId/assignments` | Auth + same society | None | Staff assignments. |
| `GET` | `/:staffId/reviews` | Auth + same society | None | Staff reviews. |
| `POST` | `/:staffId/check-out` | Guard/Resident | `{ "workCompleted"?: string, "notes"?: string }` | Staff check-out. |

### Vendors / Local Directory

Vendor router is mounted at both:

- `/api/v1/staff/vendors`
- `/api/v1/resident/local-directory`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/by-category` | Auth + same society | None | Vendors grouped by category. |
| `GET` | `/categories` | Auth + same society | None | Vendor category counts. |
| `GET` | `/` | Auth + same society | `VendorQuery` | List vendors. |
| `GET` | `/:id` | Auth + same society | None | Vendor details. |
| `POST` | `/` | Resident/Admin/Super admin | `CreateVendor` | Create vendor. |
| `PATCH` | `/:id` | Resident/Admin/Super admin | `UpdateVendor` | Update vendor. |
| `PATCH` | `/:id/verify` | Admin | None | Toggle verified. |
| `DELETE` | `/:id` | Admin | None | Delete vendor. |
| `POST` | `/:id/rate` | Resident/Admin/Super admin | `{ "rating": number }` | Add/update vendor rating. |
| `POST` | `/:id/like` | Resident/Admin/Super admin | None | Toggle vendor like. |

## Reusable Module Endpoints

These modules are mounted in multiple places. Combine each base with each suffix.

### Notices

Bases:

- `/api/v1/admin/notices`
- `/api/v1/resident/notices`
- `/api/v1/community/notices`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `NoticeQuery` | List notices. |
| `GET` | `/:id` | Auth + same society | None | Notice details. |
| `POST` | `/` | Admin | `CreateNotice` | Create notice. |
| `PATCH` | `/:id` | Admin | `UpdateNotice` | Update notice. |
| `DELETE` | `/:id` | Admin | None | Delete notice. |
| `PATCH` | `/:id/toggle-pin` | Admin | None | Toggle pin. |

### Amenities

Bases:

- `/api/v1/resident/amenities`
- `/api/v1/community/amenities`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `AmenityQuery` | List amenities. |
| `GET` | `/my-bookings` | Auth + same society | `BookingQuery` | Current user's bookings. |
| `GET` | `/bookings` | Auth + same society | `BookingQuery` | List bookings. |
| `POST` | `/` | Admin | `CreateAmenity` | Create amenity. |
| `POST` | `/bookings` | Resident/Admin/Super admin | `CreateAmenityBooking` | Create amenity booking. |
| `PATCH` | `/bookings/:id/approve` | Admin | None | Approve booking. |
| `PATCH` | `/bookings/:id/cancel` | Auth + same society | `{ "reason"?: string }` | Cancel booking. |
| `GET` | `/:id` | Auth + same society | None | Amenity details. |
| `GET` | `/:id/slots` | Auth + same society | Query: `date` as `YYYY-MM-DD` | Slot availability. |
| `POST` | `/:id/book` | Resident/Admin/Super admin | `BookAmenitySlot` | Book generated slot. |
| `PATCH` | `/:id` | Admin | `UpdateAmenity` | Update amenity. |
| `DELETE` | `/:id` | Admin | None | Delete amenity. |

### Vehicles

Bases:

- `/api/v1/admin/vehicles`
- `/api/v1/resident/vehicles`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/my` | Auth + same society | None | Current user's vehicles. |
| `POST` | `/` | Resident/Admin/Super admin | `RegisterVehicle` | Register vehicle. |
| `PATCH` | `/:id` | Resident/Admin/Super admin | `UpdateVehicle` | Update own vehicle. |
| `DELETE` | `/:id` | Resident/Admin/Super admin | None | Deactivate own vehicle. |
| `GET` | `/` | Admin | `VehicleQuery` | List all society vehicles. |
| `PATCH` | `/:id/approve` | Admin | `ApproveVehicle` | Approve/reject vehicle. |
| `GET` | `/search` | Auth + same society | `vehicleNumber` or `q` or `plateNumber` | Search vehicle by plate. |

### Documents

Bases:

- `/api/v1/admin/documents`
- `/api/v1/resident/documents`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `DocumentQuery` | List documents. |
| `POST` | `/upload-url` | Auth + same society | `DocumentUploadUrl` | Create S3 upload URL. |
| `POST` | `/confirm` | Auth + same society | `DocumentConfirmUpload` | Save uploaded document metadata. |
| `GET` | `/:id/view-url` | Auth + same society | None | Time-limited view URL. |
| `DELETE` | `/:id` | Auth + same society | None | Delete document. |

### Polls

Bases:

- `/api/v1/admin/polls`
- `/api/v1/resident/polls`

| Method | Path suffix | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `PollQuery` | List polls. |
| `GET` | `/:id` | Auth + same society | None | Poll details. |
| `POST` | `/:id/vote` | Resident/Admin/Super admin | `{ "optionId": string }` | Cast vote. |
| `POST` | `/` | Admin | `CreatePoll` | Create poll. |
| `PATCH` | `/:id` | Admin | `UpdatePoll` | Update poll. |
| `DELETE` | `/:id` | Admin | None | Delete poll. |

### Community Posts

Base: `/api/v1/resident/posts`

| Method | Path | Auth | Body / Query | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Auth + same society | `PostQuery` | List posts. |
| `POST` | `/` | Resident/Admin/Super admin | `CreatePost` | Create post. |
| `GET` | `/:id` | Auth + same society | None | Post details. |
| `DELETE` | `/:id` | Auth + same society | None | Delete own post or admin delete. |
| `PATCH` | `/:id/pin` | Admin | None | Toggle pin. |
| `POST` | `/:id/like` | Resident/Admin/Super admin | None | Toggle like. |
| `GET` | `/:id/comments` | Auth + same society | `page`, `limit` | List comments. |
| `POST` | `/:id/comments` | Resident/Admin/Super admin | `CreateComment` | Add comment. |

## Upload Endpoints

Base: `/api/v1/upload`. All routes require auth and same society.

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `POST` | `/presigned-url` | `UploadPresignedUrl` | Create S3 upload URL. |
| `POST` | `/confirm` | `UploadConfirm` | Save uploaded file metadata. |
| `GET` | `/:id/view-url` | None | Get document view URL. |
| `DELETE` | `/:id` | None | Delete document. |
| `GET` | `/entry-photo/:id` | None | Get entry request photo view URL. |

## Payload And Query Reference

Only the fields used by the current controllers/routes are listed. Fields marked `?` are optional.

### Auth Payloads

```ts
type BootstrapSuperAdmin = {
  phone: string;
  name: string;
  email?: string;
  bootstrapSecret: string;
};

type ResidentWidgetVerify = {
  widgetToken: string;
  name?: string;
  email?: string;
};

type WidgetVerify = { widgetToken: string };
type RefreshToken = { refreshToken: string };
type SwitchContext = { membershipId: string };

type UpdateProfile = {
  name?: string;
  email?: string;
  photoUrl?: string;
};

type CreateGuard = {
  name: string;
  phone: string;
  email?: string;
  photoUrl?: string;
};

type ToggleUserStatus = { isActive: boolean };
type FcmToken = { fcmToken: string; deviceType: 'android' | 'ios' };
```

### Society And Onboarding Payloads

```ts
type CreateSociety = {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  totalFlats?: number;
  monthlyFee?: number;
  subscriptionCycle?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
};

type UpdateSociety = Partial<CreateSociety> & {
  isActive?: boolean;
};

type CreateBlock = {
  name: string;
  totalFloors?: number;
  description?: string;
};

type CreateFlat = {
  blockName: string;
  flatNumber: string;
  floor?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
};

type UpdateFlat = Partial<CreateFlat> & {
  isActive?: boolean;
};

type SubmitOnboardingRequest = {
  societyId: string;
  blockId: string;
  flatId: string;
  residentType: 'OWNER' | 'TENANT';
  isLivingHere?: boolean;
  documents: Array<{
    documentType: 'OWNERSHIP_PROOF' | 'TENANT_AGREEMENT' | 'AADHAR_CARD' | 'PAN_CARD' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID' | 'OTHER';
    s3Key: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
};

type SubmitSocietyRegistration = {
  societyName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  totalFlats?: number;
  monthlyFee?: number;
  applicantIsMember?: boolean;
  adminBlockName?: string;
  adminFlatNumber?: string;
  adminResidentType?: 'OWNER' | 'TENANT';
};

type RejectSocietyRegistration = { rejectionReason: string };
```

### Gate, Invite, Entry Payloads

```ts
type CreateEntryRequest = {
  type: 'VISITOR' | 'DELIVERY' | 'DOMESTIC_STAFF' | 'CAB' | 'VENDOR';
  flatId: string;
  visitorName?: string;
  visitorPhone?: string;
  providerTag?: 'BLINKIT' | 'SWIGGY' | 'ZOMATO' | 'AMAZON' | 'FLIPKART' | 'BIGBASKET' | 'DUNZO' | 'OTHER';
  photoKey?: string;
};

type CreateGatePass = {
  flatId: string;
  type: 'MATERIAL' | 'VEHICLE' | 'MOVE_IN' | 'MOVE_OUT' | 'MAINTENANCE';
  title: string;
  description?: string;
  validFrom: string;  // ISO datetime
  validUntil: string; // ISO datetime
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  itemsList?: string[];
  workerName?: string;
  workerPhone?: string;
  companyName?: string;
  attachments?: string[];
};

type CreateGuestInvite = {
  type: 'QUICK' | 'FREQUENT' | 'PRIVATE';
  visitorName: string;
  visitorPhone: string;
  validFrom: string;  // ISO datetime
  validUntil: string; // ISO datetime
  allowedDays?: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>;
  timeFrom?: string;  // HH:MM, required for FREQUENT
  timeUntil?: string; // HH:MM, required for FREQUENT
  isPrivate?: boolean;
  note?: string;
};

type CreatePartyInvite = {
  hostName: string;
  validFrom: string;
  validUntil: string;
  venue?: string;
  maxGuests: number;
  theme?: number; // 0..5
  note?: string;
};

type AddPartyGuest = { name: string; phone: string };
type ClaimPartySlot = { phone: string };

type ScanQr = {
  qrToken: string;
  gatePointId?: string;
};

type VerifyCode = { code: string };

type CreatePreApprovedEntry = {
  type: 'CAB' | 'DELIVERY' | 'HELP';
  mode?: 'SAFE' | 'NORMAL' | 'SURPRISE';
  scheduleType?: 'ONCE' | 'RECURRING';
  visitorName?: string;
  visitorPhone?: string;
  skipDuplicateCheck?: boolean;
  date?: string;       // YYYY-MM-DD, required for ONCE
  startTime?: string;  // HH:MM, required for ONCE
  endTime?: string;    // HH:MM, required for ONCE
  validFrom?: string;  // ISO datetime, required for RECURRING
  validUntil?: string; // ISO datetime, required for RECURRING
  daysOfWeek?: Array<'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'>;
  timeFrom?: string;   // HH:MM, required for RECURRING
  timeTo?: string;     // HH:MM, required for RECURRING
  entriesPerDay?: number;
  graceBeforeMinutes?: number;
  graceAfterMinutes?: number;
  vehicleLast4Digits?: string; // required for SAFE CAB
  companyName?: string;
  isSurprise?: boolean;
  category?: 'PLUMBER' | 'ELECTRICIAN' | 'CARPENTER' | 'PAINTER' | 'TUTOR' | 'BEAUTICIAN' | 'FITNESS_TRAINER' | 'PHYSIOTHERAPIST' | 'COOK' | 'PEST_CONTROL' | 'APPLIANCE_REPAIR' | 'OTHER';
  customCategory?: string;
};

type UpdatePreApprovedEntry = {
  visitorName?: string;
  visitorPhone?: string;
  startTime?: string;
  endTime?: string;
  timeFrom?: string;
  timeTo?: string;
  daysOfWeek?: string[];
  entriesPerDay?: number;
  vehicleLast4Digits?: string;
  graceBeforeMinutes?: number;
  graceAfterMinutes?: number;
};

type ValidatePreApprovedEntry = {
  vehicleLast4?: string;
  otp?: string;
  qrToken?: string;
  flatId?: string;
  type?: 'CAB' | 'DELIVERY' | 'HELP';
};

type MarkPreApprovedUsed = {
  gatePointId?: string;
  notes?: string;
};

type AdminCancelEntry = { reason?: string };
```

### Community Payloads

```ts
type CreateNotice = {
  type: 'GENERAL' | 'URGENT' | 'EVENT' | 'MAINTENANCE' | 'MEETING' | 'EMERGENCY';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  images?: string[];
  documents?: string[];
  isUrgent?: boolean;
  isPinned?: boolean;
  publishAt?: string;
  expiresAt?: string;
};
type UpdateNotice = Partial<CreateNotice> & { isActive?: boolean };

type CreateComplaint = {
  category: 'MAINTENANCE' | 'SECURITY' | 'CLEANLINESS' | 'WATER' | 'ELECTRICITY' | 'PARKING' | 'PLUMBING' | 'NOISE' | 'PETS' | 'OTHER';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  images?: string[];
  location?: string;
  isAnonymous?: boolean;
};
type UpdateComplaintStatus = { status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED' };
type AssignComplaint = { assignedToId: string };
type ResolveComplaint = { resolution: string };

type CreateEmergency = {
  societyId: string;
  flatId?: string;
  type: 'MEDICAL' | 'FIRE' | 'SECURITY' | 'LIFT_STUCK' | 'ANIMAL_THREAT' | 'THEFT' | 'VIOLENCE' | 'ACCIDENT' | 'OTHER';
  description?: string;
  location?: string;
};
type ResolveEmergency = { notes?: string };

type CreatePost = {
  title: string;
  content: string;
  category?: 'GENERAL' | 'ANNOUNCEMENT' | 'QUESTION' | 'ISSUE' | 'APPRECIATION' | 'HELP' | 'EVENT' | 'MAINTENANCE' | 'LOST_FOUND' | 'SAFETY' | 'FOR_SALE';
  isAnonymous?: boolean;
};
type CreateComment = { content: string; isAnonymous?: boolean };

type CreatePoll = {
  title: string;
  description?: string;
  isAnonymous?: boolean;
  allowMultiple?: boolean;
  votingEndsAt?: string;
  options: string[];
};
type UpdatePoll = {
  title?: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  votingEndsAt?: string;
};
```

### Amenity, Staff, Vendor, Vehicle Payloads

```ts
type CreateAmenity = {
  name: string;
  type: 'CLUBHOUSE' | 'GYM' | 'SWIMMING_POOL' | 'PARTY_HALL' | 'SPORTS_COURT' | 'BANQUET_HALL' | 'GARDEN' | 'OTHER';
  description?: string;
  capacity?: number;
  openTime?: string;
  closeTime?: string;
  timings?: string;
  slotDurationHours?: number;
  rules?: string[];
  bookingDuration?: number;
  advanceBookingDays?: number;
  maxBookingsPerUser?: number;
  pricePerHour?: number;
  images?: string[];
};
type UpdateAmenity = Partial<CreateAmenity> & { isActive?: boolean };
type CreateAmenityBooking = {
  amenityId: string;
  flatId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  guestCount?: number;
  purpose?: string;
};
type BookAmenitySlot = {
  slotId: string; // "<amenityId>_<YYYY-MM-DD>_<HH:MM>"
  date: string;
  members?: string[];
  purpose?: string;
};

type CreateStaff = {
  name: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  staffType: 'MAID' | 'COOK' | 'NANNY' | 'DRIVER' | 'CLEANER' | 'GARDENER' | 'LAUNDRY' | 'CARETAKER' | 'SECURITY_GUARD' | 'OTHER';
  experienceYears?: number;
  description?: string;
  languages?: string[];
  idProofType?: string;
  idProofNumber?: string;
  idProofUrl?: string;
  address?: string;
  emergencyContact?: string;
  isFullTime?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
};
type UpdateStaff = Partial<CreateStaff> & {
  availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'INACTIVE';
  isActive?: boolean;
};
type CreateStaffAssignment = {
  domesticStaffId: string;
  flatId: string;
  isPrimary?: boolean;
  workingDays?: string[];
  workStartTime?: string;
  workEndTime?: string;
  agreedRate?: number;
  rateType?: string;
};
type UpdateStaffAssignment = Partial<CreateStaffAssignment> & { isActive?: boolean };
type StaffCheckIn = {
  domesticStaffId: string;
  flatId: string;
  societyId: string;
  checkInMethod?: string;
  notes?: string;
};
type StaffScanQr = { qrToken: string; flatId: string; societyId: string };
type CreateStaffBooking = {
  domesticStaffId: string;
  flatId: string;
  societyId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  workType: string;
  requirements?: string;
  estimatedCost?: number;
};
type CreateStaffReview = {
  domesticStaffId: string;
  flatId: string;
  rating: number;
  review?: string;
  workQuality?: number;
  punctuality?: number;
  behavior?: number;
  workType?: string;
  workDate?: string;
};

type CreateVendor = {
  name: string;
  category: 'PLUMBER' | 'ELECTRICIAN' | 'CARPENTER' | 'PAINTER' | 'CLEANER' | 'GARDENER' | 'PEST_CONTROL' | 'APPLIANCE_REPAIR' | 'OTHER';
  phone: string;
  email?: string;
  alternatePhone?: string;
  companyName?: string;
  description?: string;
  address?: string;
  workingDays?: string[];
  workingHours?: string;
  hourlyRate?: number;
  minCharge?: number;
  idProof?: string;
  photos?: string[];
};
type UpdateVendor = Partial<CreateVendor> & { isActive?: boolean };

type RegisterVehicle = {
  vehicleNumber: string;
  vehicleType: string;
  model?: string;
  color?: string;
};
type UpdateVehicle = {
  model?: string;
  color?: string;
  parkingSlot?: string;
};
type ApproveVehicle = {
  status: 'ACTIVE' | 'REJECTED';
  parkingSlot?: string;
  stickerNumber?: string;
  rejectionNote?: string;
};
```

### Billing, Payment, Upload Payloads

```ts
type GenerateInvoices = {
  month: string;
  amountPerFlat: number;
  description?: string;
  dueDate: string; // ISO datetime
};
type Penalty = { amount: number };

type CreateCashfreeOrder = {
  returnUrl?: string;
  notifyUrl?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
};

type Broadcast = {
  title: string;
  message: string;
  isEmergency?: boolean;
  target?: string; // "ALL" or blockId
};

type DocumentUploadUrl = {
  fileName: string;
  contentType: string;
  category: 'RULES_AND_BYLAWS' | 'MEETING_MINUTES' | 'FINANCIAL' | 'CIRCULAR' | 'MAINTENANCE' | 'LEGAL' | 'PERSONAL' | 'OTHER';
  name: string;
  description?: string;
  isAdminDoc?: boolean;
};
type DocumentConfirmUpload = {
  s3Key: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  category: 'RULES_AND_BYLAWS' | 'MEETING_MINUTES' | 'FINANCIAL' | 'CIRCULAR' | 'MAINTENANCE' | 'LEGAL' | 'PERSONAL' | 'OTHER';
  name: string;
  description?: string;
  isAdminDoc?: boolean;
};

type UploadPresignedUrl = {
  context: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType?: string;
};
type UploadConfirm = {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  onboardingRequestId?: string;
};
```

### Parking Payloads

```ts
type IssueParkingViolation = {
  vehicleNumber: string;
  plateNumber?: string;
  type: 'WRONG_PARKING' | 'DOUBLE_PARKING' | 'BLOCKING_GATE' | 'UNAUTHORIZED_SPOT' | 'NO_STICKER' | 'OTHER';
  description?: string;
  penaltyAmount?: number;
  addToInvoice?: boolean;
};

type IssueParkingViolationForVehicle = {
  type: 'WRONG_PARKING' | 'DOUBLE_PARKING' | 'BLOCKING_GATE' | 'UNAUTHORIZED_SPOT' | 'NO_STICKER' | 'OTHER';
  description?: string;
  penaltyAmount?: number;
  addToInvoice?: boolean;
};

type ParkingComplaint = {
  vehicleNumber: string;
  type: 'WRONG_PARKING' | 'DOUBLE_PARKING' | 'BLOCKING_GATE' | 'UNAUTHORIZED_SPOT' | 'NO_STICKER' | 'OTHER';
  description?: string;
};

type ResolveParkingViolation = {
  status: 'RESOLVED' | 'DISMISSED';
  resolutionNote?: string;
};
```

### Common Query Objects

```ts
type PageQuery = { page?: number; limit?: number };
type BooleanString = 'true' | 'false';

type EntryRequestQuery = PageQuery & {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  flatId?: string;
};

type EntryLogQuery = PageQuery & {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHECKED_IN' | 'CHECKED_OUT';
  type?: 'VISITOR' | 'DELIVERY' | 'DOMESTIC_STAFF' | 'CAB' | 'VENDOR';
  flatId?: string;
};

type GatePassQuery = PageQuery & {
  flatId?: string;
  type?: 'MATERIAL' | 'VEHICLE' | 'MOVE_IN' | 'MOVE_OUT' | 'MAINTENANCE';
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'USED' | 'EXPIRED';
};

type PreApprovedQuery = PageQuery & {
  type?: 'CAB' | 'DELIVERY' | 'HELP';
  status?: 'ACTIVE' | 'EXPIRED' | 'USED' | 'CANCELLED';
};

type AdminPreApprovedQuery = PreApprovedQuery & {
  flatId?: string;
  dateFrom?: string;
  dateTo?: string;
};

type NoticeQuery = PageQuery & {
  type?: string;
  priority?: string;
  isPinned?: BooleanString;
  isActive?: BooleanString;
};

type AmenityQuery = PageQuery & {
  type?: string;
  isActive?: BooleanString;
};

type BookingQuery = PageQuery & {
  amenityId?: string;
  userId?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  bookingDate?: string;
};

type ComplaintQuery = PageQuery & {
  flatId?: string;
  reportedById?: string;
  assignedToId?: string;
  category?: string;
  status?: string;
  priority?: string;
};

type EmergencyQuery = PageQuery & {
  status?: 'ACTIVE' | 'RESOLVED' | 'FALSE_ALARM';
  type?: string;
};

type PostQuery = PageQuery & {
  category?: string;
  authorId?: string;
};

type PollQuery = PageQuery & {
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
};

type StaffQuery = PageQuery & {
  staffType?: string;
  availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'INACTIVE';
  isVerified?: BooleanString;
  isActive?: BooleanString;
  search?: string;
};

type AttendanceQuery = PageQuery & {
  societyId?: string;
  flatId?: string;
  domesticStaffId?: string;
  startDate?: string;
  endDate?: string;
};

type StaffBookingQuery = PageQuery & {
  domesticStaffId?: string;
  bookedById?: string;
  flatId?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  bookingDate?: string;
};

type VendorQuery = PageQuery & {
  category?: string;
  isVerified?: BooleanString;
  isActive?: BooleanString;
};

type VehicleQuery = PageQuery & {
  status?: 'PENDING' | 'ACTIVE' | 'REJECTED';
  vehicleType?: string;
  flatId?: string;
};

type DocumentQuery = PageQuery & {
  category?: string;
  isAdminDoc?: BooleanString;
};

type BillingListQuery = PageQuery & {
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
  month?: string;
};

type ParkingViolationQuery = PageQuery & {
  source?: 'OFFICIAL' | 'COMPLAINT';
  status?: 'OPEN' | 'NOTIFIED' | 'RESOLVED' | 'DISMISSED';
  vehicleId?: string;
};
```

## Active Route Source Files Checked

- `src/app.ts`
- `src/routes/v1/index.ts`
- `src/routes/v1/admin.routes.ts`
- `src/routes/v1/resident.routes.ts`
- `src/routes/v1/gate.routes.ts`
- `src/routes/v1/guard.routes.ts`
- `src/routes/v1/staff.routes.ts`
- `src/routes/v1/community.routes.ts`
- `src/modules/**/**.routes.ts`
- `src/modules/**/**.controller.ts`
- `src/schemas/index.ts`
- `src/types/index.ts`
- `prisma/schema.prisma`

Note: `src/modules/gate-scan/gate-scan.routes.ts` defines `POST /`, but it is not mounted in `src/routes/v1/index.ts`; its controller functions are exposed through `/api/v1/gate/*` and `/api/v1/guard/*`.
