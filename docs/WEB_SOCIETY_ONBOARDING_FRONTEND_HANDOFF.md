# Web Society Onboarding Frontend Handoff

This document is for the web/admin frontend developer.

Society onboarding happens on the web dashboard only. The resident mobile app must not create or configure societies.

Base URL:

```text
/api/v1
```

Auth header:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## 1. Product Boundary

Use the web/admin dashboard for:

- Lead capture and empty society profile creation.
- Inviting the society secretary/admin.
- Basic/legal/financial details.
- Society registration and signatory document upload.
- Super admin verification.
- Excel/CSV import for blocks, flats, owners, tenants, and vehicles.
- Gates, guard accounts, devices, rules, billing, logo, and branding.
- Final society activation and resident invitations.

Use the resident app only for:

- Resident OTP login/signup.
- Joining/searching an active society.
- Selecting block/flat.
- Uploading resident documents.
- Checking resident approval status.
- Using resident features after approval.

Do not build society setup screens in the resident app.

## 2. Auth

### Web Admin Login

Use existing admin/web login:

```http
POST /auth/admin-app/otp/verify
```

Body:

```json
{
  "widgetToken": "MSG91_WIDGET_TOKEN"
}
```

Use the returned `accessToken` for all routes below.

Invited society admins can log in even while the society itself is not activated for residents yet. The society onboarding routes use onboarding-compatible auth.

## 3. Status Values

Society onboarding status values:

```text
LEAD
PROFILE_CREATED
DOCS_PENDING
PENDING_VERIFICATION
VERIFIED
IMPORT_PENDING
CONFIG_PENDING
ACTIVE
REJECTED
```

Frontend step mapping:

```text
LEAD / PROFILE_CREATED  -> Basic setup and admin invitation
DOCS_PENDING            -> Upload documents/logo/details
PENDING_VERIFICATION    -> Waiting for super admin/compliance approval
IMPORT_PENDING          -> Bulk import blocks/flats/residents/vehicles
CONFIG_PENDING          -> Rules, branding, gates, guards, billing
ACTIVE                  -> Society is live for resident app
REJECTED                -> Show rejection/re-upload path
```

Only societies with:

```text
isActive: true
onboardingStatus: ACTIVE
```

appear in resident app society search.

## 4. Recommended Web Screens

1. Super Admin: Society onboarding leads/list.
2. Super Admin: Create lead/profile.
3. Super Admin: Invite secretary/admin.
4. Society Admin: Basic/legal details.
5. Society Admin: Financial/billing details.
6. Society Admin: Document/logo upload.
7. Super Admin: Verification review.
8. Society Admin: Import template download/upload.
9. Society Admin: Import validation errors.
10. Society Admin: Commit import.
11. Society Admin: Configure rules, branding, gates, devices, guards.
12. Society Admin/Super Admin: Activate society.
13. Society Admin/Super Admin: Send resident invitations.

## 5. Permissions

| Route group | Allowed roles |
| --- | --- |
| Create lead | `SUPER_ADMIN` |
| Invite society admin | `SUPER_ADMIN` |
| Approve/reject verification | `SUPER_ADMIN` |
| View status | `ADMIN`, `SUPER_ADMIN` |
| Basic/financial details | `ADMIN`, `SUPER_ADMIN` |
| Document upload/save | `ADMIN`, `SUPER_ADMIN` |
| Submit verification | `ADMIN`, `SUPER_ADMIN` |
| Import validate/commit | `ADMIN`, `SUPER_ADMIN` |
| Rules/branding/gates/guards | `ADMIN`, `SUPER_ADMIN` |
| Activate/invite residents | `ADMIN`, `SUPER_ADMIN` |

An `ADMIN` can manage only their own society. `SUPER_ADMIN` can manage any society.

## 6. Lead And Admin Invite

### Create Society Lead

`SUPER_ADMIN` only.

```http
POST /admin/society-onboarding/leads
```

Body:

```json
{
  "name": "Greenfield Heights",
  "registeredName": "Greenfield Heights Cooperative Housing Society Ltd",
  "registrationNumber": "REG-12345",
  "address": "Building 12, Main Road",
  "city": "Jamshedpur",
  "state": "Jharkhand",
  "pincode": "831012",
  "latitude": 22.8046,
  "longitude": 86.2029,
  "contactName": "Rakesh Kumar",
  "contactPhone": "9876543210",
  "contactEmail": "secretary@example.com",
  "totalFlats": 120
}
```

Result:

- Creates an inactive society.
- Sets `onboardingStatus: "LEAD"`.
- Society is not visible in resident app search.

Response:

```json
{
  "success": true,
  "message": "Society lead created",
  "data": {
    "id": "society-id",
    "name": "Greenfield Heights",
    "isActive": false,
    "onboardingStatus": "LEAD"
  }
}
```

### Invite Society Admin

`SUPER_ADMIN` only.

```http
POST /admin/society-onboarding/:societyId/invite-admin
```

Body:

```json
{
  "name": "Rakesh Kumar",
  "phone": "9876543210",
  "email": "secretary@example.com"
}
```

Result:

- Creates or updates a web `ADMIN` user for the society.
- Admin logs in using OTP through `/auth/admin-app/otp/verify`.
- Moves society from `LEAD` to `PROFILE_CREATED`.

## 7. Status API

Use this after every major save/action to refresh the wizard.

```http
GET /admin/society-onboarding/:societyId/status
```

Response includes:

- Society details.
- `onboardingStatus`.
- Documents.
- Latest import batches and row errors.
- Gate points and devices.
- Rule config.
- Counts for blocks, flats, users, and vehicles.

Example:

```json
{
  "success": true,
  "data": {
    "id": "society-id",
    "name": "Greenfield Heights",
    "registeredName": "Greenfield Heights Cooperative Housing Society Ltd",
    "registrationNumber": "REG-12345",
    "isActive": false,
    "onboardingStatus": "IMPORT_PENDING",
    "onboardingDocuments": [],
    "importBatches": [],
    "gatePoints": [],
    "ruleConfig": null,
    "_count": {
      "blocks": 0,
      "flats": 0,
      "users": 1,
      "vehicles": 0
    }
  }
}
```

## 8. Basic And Financial Details

### Update Basic Details

```http
PATCH /admin/society-onboarding/:societyId/basic-details
```

Body can contain any of:

```json
{
  "name": "Greenfield Heights",
  "registeredName": "Greenfield Heights Cooperative Housing Society Ltd",
  "registrationNumber": "REG-12345",
  "address": "Building 12, Main Road",
  "city": "Jamshedpur",
  "state": "Jharkhand",
  "pincode": "831012",
  "latitude": 22.8046,
  "longitude": 86.2029,
  "contactName": "Rakesh Kumar",
  "contactPhone": "9876543210",
  "contactEmail": "secretary@example.com",
  "totalFlats": 120
}
```

Result:

- Updates society profile.
- Sets `onboardingStatus: "DOCS_PENDING"`.

### Update Financial Details

```http
PATCH /admin/society-onboarding/:societyId/financial-details
```

Body:

```json
{
  "bankAccountNumber": "123456789012",
  "bankIfsc": "HDFC0001234",
  "bankBranchName": "Jamshedpur Main",
  "panNumber": "ABCDE1234F",
  "gstin": "20ABCDE1234F1Z5",
  "monthlyFee": 2500,
  "maintenanceBillingType": "FLAT",
  "maintenanceBillingConfig": {
    "flatMonthlyFee": 2500
  }
}
```

Supported `maintenanceBillingType`:

```text
FLAT
SQUARE_FOOT
CUSTOM
```

Examples:

```json
{
  "maintenanceBillingType": "SQUARE_FOOT",
  "maintenanceBillingConfig": {
    "ratePerSquareFoot": 3.5,
    "minimumMonthlyAmount": 1000
  }
}
```

```json
{
  "maintenanceBillingType": "CUSTOM",
  "maintenanceBillingConfig": {
    "rules": [
      { "label": "1BHK", "amount": 1500 },
      { "label": "2BHK", "amount": 2500 },
      { "label": "3BHK", "amount": 3500 }
    ]
  }
}
```

## 9. Document And Logo Upload

Document types:

```text
REGISTRATION_CERTIFICATE
AUTHORIZED_SIGNATORY_ID
PAN_PROOF
GST_PROOF
BANK_PROOF
LOGO
OTHER
```

Required before submitting verification:

- `REGISTRATION_CERTIFICATE`
- `AUTHORIZED_SIGNATORY_ID`

### Step 1: Get Upload URL

```http
POST /admin/society-onboarding/:societyId/documents/presigned-url
```

Body:

```json
{
  "fileName": "registration-certificate.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000,
  "documentType": "REGISTRATION_CERTIFICATE"
}
```

For logo:

```json
{
  "fileName": "logo.png",
  "mimeType": "image/png",
  "fileSize": 120000,
  "documentType": "LOGO"
}
```

Response:

```json
{
  "success": true,
  "message": "Upload URL generated",
  "data": {
    "uploadUrl": "https://...",
    "s3Key": "general/user-id/..."
  }
}
```

Frontend must upload the file directly to `uploadUrl` using `PUT`.

### Step 2: Save Document Metadata

```http
POST /admin/society-onboarding/:societyId/documents
```

Body:

```json
{
  "documentType": "REGISTRATION_CERTIFICATE",
  "fileKey": "general/user-id/registration-certificate.pdf",
  "fileName": "registration-certificate.pdf",
  "fileSizeMB": 0.24,
  "fileType": "application/pdf"
}
```

For logo:

```json
{
  "documentType": "LOGO",
  "fileKey": "general/user-id/logo.png",
  "fileName": "logo.png",
  "fileSizeMB": 0.12,
  "fileType": "image/png"
}
```

Logo saves document metadata and updates society `logoKey`.

### Submit For Verification

```http
POST /admin/society-onboarding/:societyId/submit-verification
```

Body:

```json
{}
```

Result:

- Requires registration certificate and authorized signatory ID.
- Sets `onboardingStatus: "PENDING_VERIFICATION"`.

### Approve Verification

`SUPER_ADMIN` only.

```http
POST /admin/society-onboarding/:societyId/approve
```

Body:

```json
{
  "notes": "Documents verified"
}
```

Result:

- Marks pending documents verified.
- Sets `onboardingStatus: "IMPORT_PENDING"`.

### Reject Verification

`SUPER_ADMIN` only.

```http
POST /admin/society-onboarding/:societyId/reject
```

Body:

```json
{
  "reason": "Registration certificate is not readable"
}
```

Result:

- Sets `onboardingStatus: "REJECTED"`.
- Society remains inactive.

## 10. Bulk Import

Import supports `.xlsx`, `.csv`, or direct JSON rows.

Backend requires the society to be verified before import:

```text
IMPORT_PENDING or CONFIG_PENDING
```

### Download Template

```http
GET /admin/society-onboarding/import-template
```

Response:

- `text/csv`
- filename: `society-import-template.csv`

Template columns:

```text
Block
Flat Number
Floor
Owner Name
Owner Phone
Tenant Name
Tenant Phone
Vehicle Numbers
Occupancy Status
Square Feet
```

Allowed occupancy values:

```text
Owner Occupied
Rented
Vacant
```

Vehicle numbers may be separated by comma, semicolon, pipe, or newline.

### Validate Import From File

Frontend should read the selected file as base64 and send only the base64 content, without the `data:*/*;base64,` prefix.

```http
POST /admin/society-onboarding/:societyId/import/validate
```

Body:

```json
{
  "fileName": "greenfield-import.xlsx",
  "fileContentBase64": "UEsDBBQAAAA..."
}
```

### Validate Import From JSON Rows

Useful for a custom web spreadsheet/table UI.

```http
POST /admin/society-onboarding/:societyId/import/validate
```

Body:

```json
{
  "rows": [
    {
      "Block": "Tower A",
      "Flat Number": "A-101",
      "Floor": "1",
      "Owner Name": "Anil Sharma",
      "Owner Phone": "9876543210",
      "Tenant Name": "",
      "Tenant Phone": "",
      "Vehicle Numbers": "JH05AB1234; JH05AB5678",
      "Occupancy Status": "Owner Occupied",
      "Square Feet": 1200
    }
  ]
}
```

Validation catches:

- Missing block.
- Missing flat number.
- Duplicate flats in the file.
- Invalid owner/tenant phone.
- Rented/tenant row without tenant phone.
- Duplicate vehicle numbers.
- Vehicles already registered in the society.
- Invalid occupancy status.
- Non-positive square feet.

Successful validation response:

```json
{
  "success": true,
  "message": "Import file validated",
  "data": {
    "id": "batch-id",
    "status": "VALIDATED",
    "totalRows": 100,
    "validRows": 100,
    "errorRows": 0,
    "rowErrors": []
  }
}
```

Validation error response:

The HTTP status is still `201`, but `success` is `false`.

```json
{
  "success": false,
  "message": "Import file has validation errors",
  "data": {
    "id": "batch-id",
    "status": "VALIDATION_FAILED",
    "totalRows": 100,
    "validRows": 96,
    "errorRows": 4,
    "rowErrors": [
      {
        "rowNumber": 8,
        "field": "Tenant Phone",
        "message": "Tenant phone is required for rented flats or tenant rows",
        "rowData": {
          "Block": "Tower A",
          "Flat Number": "A-108"
        }
      }
    ]
  }
}
```

Frontend behavior:

- Show row-level errors.
- Let the user fix and re-upload/re-validate.
- Do not call commit unless status is `VALIDATED`.

### Commit Import

```http
POST /admin/society-onboarding/:societyId/import/commit
```

Body:

```json
{
  "batchId": "batch-id"
}
```

Commit creates/updates:

- Blocks.
- Flats.
- Owner and tenant users.
- `UserFlatMembership`.
- Owner/tenant flat mapping.
- Vehicle records.

Imported users are OTP users. No password is created.

Response:

```json
{
  "success": true,
  "message": "Society import committed",
  "data": {
    "batchId": "batch-id",
    "summary": {
      "blocksCreated": 3,
      "flatsUpserted": 120,
      "residentsUpserted": 180,
      "membershipsUpserted": 180,
      "vehiclesUpserted": 95
    }
  }
}
```

Result:

- Sets `onboardingStatus: "CONFIG_PENDING"`.

## 11. Rules, Branding, Gates, Guards

### Update Society Rules

```http
PATCH /admin/society-onboarding/:societyId/rules
```

Body:

```json
{
  "deliveryCheckInRequired": true,
  "guestParkingHours": 4,
  "visitorOtpRequired": true,
  "customRules": {
    "deliveryExecutivesMustCheckIn": true,
    "guestParkingAllowedHours": 4,
    "visitorOtpMandatory": true,
    "notes": [
      "All visitors must check in at the main gate",
      "Guest parking allowed for 4 hours"
    ]
  }
}
```

### Update Branding

```http
PATCH /admin/society-onboarding/:societyId/branding
```

Body:

```json
{
  "logoKey": "general/user-id/logo.png",
  "logoUrl": null
}
```

Usually use the document upload flow with `documentType: "LOGO"` first, then save `logoKey` here if the UI allows logo replacement from a media picker.

### Configure Gates And Devices

```http
POST /admin/society-onboarding/:societyId/gates
```

Body:

```json
{
  "gates": [
    {
      "name": "Main Gate",
      "devices": [
        {
          "deviceName": "Main Gate Tablet 1",
          "deviceIdentifier": "TAB-MAIN-001"
        }
      ]
    },
    {
      "name": "Back Gate",
      "devices": [
        {
          "deviceName": "Back Gate Tablet 1",
          "deviceIdentifier": "TAB-BACK-001"
        }
      ]
    }
  ]
}
```

### Create Guard Accounts

```http
POST /admin/society-onboarding/:societyId/guards
```

Body:

```json
{
  "guards": [
    {
      "name": "Ramesh Guard",
      "phone": "9876543210",
      "photoUrl": "https://..."
    },
    {
      "name": "Suresh Guard",
      "phone": "9876543211"
    }
  ]
}
```

Result:

- Creates/updates `GUARD` users.
- Guards log in by OTP through the guard app.

## 12. Activation And Resident Invites

### Activate Society

```http
POST /admin/society-onboarding/:societyId/activate
```

Body:

```json
{}
```

Activation requires:

- Society is verified/configured enough.
- At least one active flat exists.
- At least one active gate exists.
- At least one active guard exists.
- Society rules are configured.

Result:

- Sets `isActive: true`.
- Sets `onboardingStatus: "ACTIVE"`.
- Society becomes visible to resident app search.

### Send Resident Invitations

```http
POST /admin/society-onboarding/:societyId/send-resident-invites
```

Body:

```json
{}
```

Result:

- Creates in-app invitation notifications.
- Sends SMS if `MSG91_RESIDENT_INVITE_TEMPLATE_ID` is configured.
- Sends email if `EMAIL_INVITE_WEBHOOK_URL` is configured and resident email exists.

Response:

```json
{
  "success": true,
  "message": "Resident invitations queued",
  "data": {
    "sent": 120,
    "channels": ["in_app", "sms", "email"],
    "delivery": {
      "inAppCreated": 120,
      "smsDelivered": 118,
      "emailDelivered": 40,
      "smsConfigured": true,
      "emailConfigured": true
    },
    "message": "Resident invitations processed"
  }
}
```

## 13. Resident App Login Redirects

The resident app login endpoint now returns better routing data.

```http
POST /auth/otp/verify
```

If resident already submitted onboarding and is waiting:

```json
{
  "success": true,
  "data": {
    "requiresOnboarding": true,
    "onboardingStatus": "PENDING_APPROVAL",
    "redirectTo": "ONBOARDING_STATUS",
    "nextAction": "WAIT_FOR_APPROVAL"
  }
}
```

Frontend behavior:

- Show approval waiting screen.
- Do not show the fresh onboarding form.

Other important values:

```text
redirectTo: ONBOARDING
nextAction: START_ONBOARDING | COMPLETE_ONBOARDING

redirectTo: ONBOARDING_RESUBMIT
nextAction: RESUBMIT_DOCUMENTS

redirectTo: ONBOARDING_STATUS
nextAction: WAIT_FOR_APPROVAL | WAIT_FOR_SOCIETY_ACTIVATION | REAPPLY

redirectTo: RESIDENT_PANEL
nextAction: OPEN_RESIDENT_PANEL

redirectTo: ADMIN_PANEL
nextAction: OPEN_ADMIN_PANEL
```

## 14. Frontend Wizard Guardrails

- Do not let society admin commit import before validation succeeds.
- Do not show activate button until status is `CONFIG_PENDING` and required setup is complete.
- Always refresh `GET /admin/society-onboarding/:societyId/status` after save/submit/approve/import/activate actions.
- Treat `rowErrors` as table validation errors with row number and field.
- Keep resident app pages separate from web society onboarding pages.
- Do not call `/society-registration/request` from resident app or web onboarding; this old resident self-service route is disabled.

## 15. Environment Variables For Invites

Backend supports optional external delivery:

```text
MSG91_RESIDENT_INVITE_TEMPLATE_ID=your-msg91-flow-template-id
RESIDENT_APP_DOWNLOAD_URL=https://your-app.example.com/download
EMAIL_INVITE_WEBHOOK_URL=https://your-email-provider.example.com/send
```

If SMS/email env vars are missing, in-app notification records are still created and the response reports `smsConfigured: false` or `emailConfigured: false`.
