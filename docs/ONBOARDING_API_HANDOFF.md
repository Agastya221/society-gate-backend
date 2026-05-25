# S-Gate Onboarding API Handoff

This document is for the frontend/web developer implementing the MyGate-style onboarding flow.

Base URL:

```text
https://society-gate-backend-gsrq.onrender.com/api/v1
```

Auth header for protected APIs:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Product Rule

S-Gate now follows this onboarding model:

1. Societies are created first by S-Gate back office or a SUPER_ADMIN web panel.
2. Blocks/towers and flats are added by SUPER_ADMIN or society ADMIN.
3. Resident app users cannot create a new society from the app.
4. Resident app users can only search an active society, select block/tower, select flat, choose owner/tenant, upload docs, and submit for admin approval.
5. One user can have multiple flats in the same society and in different societies after each flat membership is approved.
6. Owner can be either:
   - residing owner: `isLivingHere: true`
   - non-residing owner: `isLivingHere: false`
7. Tenant is always treated as living there: send `isLivingHere: true` or omit it.

Do not build an in-app "register my society" form as an active flow. If society is not found, show a message asking the user to contact S-Gate/society office.

## Auth APIs

### Resident app login/signup

Use after MSG91 widget verification.

```http
POST /auth/otp/verify
```

Body:

```json
{
  "widgetToken": "MSG91_WIDGET_TOKEN",
  "name": "Resident Name",
  "email": "resident@example.com"
}
```

Use this for resident onboarding because it can create a new user if the phone is new.

### Admin/web login

Use after MSG91 widget verification for existing ADMIN, RESIDENT, or SUPER_ADMIN users.

```http
POST /auth/admin-app/otp/verify
```

Body:

```json
{
  "widgetToken": "MSG91_WIDGET_TOKEN"
}
```

Response includes `accessToken` and user details. Use that token for all admin/back-office APIs.

## Back Office / Web Panel APIs

Use these APIs from the web admin/back-office panel to prepare societies before residents join.

### Create Society

SUPER_ADMIN only.

```http
POST /admin/societies
```

Body:

```json
{
  "name": "Greenfield Heights",
  "address": "Main Road, Jamshedpur",
  "city": "Jamshedpur",
  "state": "Jharkhand",
  "pincode": "831012",
  "contactName": "Javed Hussain",
  "contactPhone": "9006412619",
  "contactEmail": "javed@example.com",
  "totalFlats": 100,
  "monthlyFee": 2500
}
```

Notes:

- Society is created active by default.
- Backend creates default `Main Gate`.
- Backend creates hidden virtual `Admin` block and `OFFICE` flat for management use. This is not shown in resident onboarding.

### List Societies

SUPER_ADMIN only.

```http
GET /admin/societies?page=1&limit=20
```

Optional query:

```text
city=Jamshedpur
isActive=true
```

### Get Society Details

ADMIN or SUPER_ADMIN.

```http
GET /admin/societies/:societyId
```

### Update Society

ADMIN or SUPER_ADMIN.

```http
PATCH /admin/societies/:societyId
```

Body can contain fields to update, for example:

```json
{
  "name": "Greenfield Heights",
  "monthlyFee": 3000,
  "contactPhone": "9006412619"
}
```

### Create Block / Tower

ADMIN or SUPER_ADMIN.

```http
POST /admin/societies/:societyId/blocks
```

Body:

```json
{
  "name": "Tower A",
  "totalFloors": 12,
  "description": "Main residential tower"
}
```

### Create Flat

ADMIN or SUPER_ADMIN.

```http
POST /admin/societies/:societyId/flats
```

Body:

```json
{
  "blockName": "Tower A",
  "flatNumber": "A-101",
  "floor": "1",
  "ownerName": "Optional Owner Name",
  "ownerPhone": "9006412619",
  "ownerEmail": "owner@example.com"
}
```

Notes:

- `blockName` is required.
- If the block does not exist, backend creates it automatically.
- `flatNumber` is required.
- Owner fields are optional metadata. The real app access is still granted only after onboarding approval.

### Update Flat

ADMIN or SUPER_ADMIN.

```http
PATCH /admin/societies/:societyId/flats/:flatId
```

Body:

```json
{
  "blockName": "Tower B",
  "flatNumber": "B-401",
  "floor": "4",
  "ownerName": "Updated Owner Name",
  "ownerPhone": "9006412619",
  "ownerEmail": "owner@example.com",
  "isActive": true
}
```

### Deactivate Flat

ADMIN or SUPER_ADMIN.

```http
DELETE /admin/societies/:societyId/flats/:flatId
```

This soft-deactivates the flat with `isActive: false`.

## Resident App Onboarding APIs

These are used by the mobile app after resident login.

### Search Active Societies

```http
GET /resident/onboarding/societies?city=Jamshedpur&search=green
```

Query params are optional:

```text
city=Jamshedpur
search=green
```

Response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "society-id",
      "name": "Greenfield Heights",
      "address": "Main Road",
      "city": "Jamshedpur",
      "state": "Jharkhand",
      "pincode": "831012",
      "totalFlats": 100,
      "totalBlocks": 3
    }
  ]
}
```

If no result is found, show:

```text
Society is not active on S-Gate yet. Please contact your society office or S-Gate support.
```

Do not call `/society-registration/request` from the app.

### List Blocks / Towers

```http
GET /resident/onboarding/societies/:societyId/blocks
```

Response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "block-id",
      "name": "Tower A",
      "totalFloors": 12,
      "description": "Main residential tower",
      "totalFlats": 48
    }
  ]
}
```

The hidden `Admin` block is excluded by the backend.

### List Flats

```http
GET /resident/onboarding/societies/:societyId/blocks/:blockId/flats
```

Response shape:

```json
{
  "success": true,
  "data": [
    {
      "id": "flat-id",
      "flatNumber": "A-101",
      "floor": "1",
      "blockName": "Tower A",
      "isOccupied": false,
      "hasOwner": false,
      "hasTenant": false,
      "ownerName": null,
      "canApply": true
    }
  ]
}
```

Frontend behavior:

- User selects one flat.
- Then ask: `Owner` or `Tenant`.
- If owner, ask: `Are you living in this flat?`
- Send `isLivingHere: true` for residing owner.
- Send `isLivingHere: false` for non-residing owner.
- For tenant, send `residentType: "TENANT"` and omit `isLivingHere` or send `true`.

### Submit Onboarding Request

```http
POST /resident/onboarding/request
```

Owner, living in flat:

```json
{
  "societyId": "society-id",
  "blockId": "block-id",
  "flatId": "flat-id",
  "residentType": "OWNER",
  "isLivingHere": true,
  "documents": [
    {
      "type": "OWNERSHIP_PROOF",
      "s3Key": "onboarding/user-id/sale-deed.pdf",
      "fileName": "sale-deed.pdf",
      "fileSize": 245000,
      "mimeType": "application/pdf"
    },
    {
      "type": "AADHAR_CARD",
      "s3Key": "onboarding/user-id/aadhar.pdf",
      "fileName": "aadhar.pdf",
      "fileSize": 180000,
      "mimeType": "application/pdf"
    }
  ]
}
```

Owner, not living in flat:

```json
{
  "societyId": "society-id",
  "blockId": "block-id",
  "flatId": "flat-id",
  "residentType": "OWNER",
  "isLivingHere": false,
  "documents": [
    {
      "type": "OWNERSHIP_PROOF",
      "s3Key": "onboarding/user-id/sale-deed.pdf"
    },
    {
      "type": "PAN_CARD",
      "s3Key": "onboarding/user-id/pan.pdf"
    }
  ]
}
```

Tenant:

```json
{
  "societyId": "society-id",
  "blockId": "block-id",
  "flatId": "flat-id",
  "residentType": "TENANT",
  "documents": [
    {
      "type": "TENANT_AGREEMENT",
      "s3Key": "onboarding/user-id/rent-agreement.pdf"
    },
    {
      "type": "AADHAR_CARD",
      "s3Key": "onboarding/user-id/aadhar.pdf"
    }
  ]
}
```

Document validation rules:

- OWNER requires `OWNERSHIP_PROOF`.
- TENANT requires `TENANT_AGREEMENT`.
- Everyone requires at least one ID proof:
  - `AADHAR_CARD`
  - `PAN_CARD`
  - `PASSPORT`
  - `DRIVING_LICENSE`
  - `VOTER_ID`
- Each document must include either `s3Key` or `url`.

Valid document types:

```text
OWNERSHIP_PROOF
TENANT_AGREEMENT
AADHAR_CARD
PAN_CARD
PASSPORT
DRIVING_LICENSE
VOTER_ID
OTHER
```

Success response:

```json
{
  "success": true,
  "message": "Onboarding request submitted successfully",
  "data": {
    "requestId": "request-id",
    "status": "PENDING_APPROVAL",
    "submittedAt": "2026-05-20T10:00:00.000Z",
    "estimatedReviewTime": "24-48 hours"
  }
}
```

### Get My Onboarding Status

```http
GET /resident/onboarding/status
```

Response shape:

```json
{
  "success": true,
  "data": {
    "status": "PENDING_APPROVAL",
    "society": "Greenfield Heights",
    "block": "Tower A",
    "flat": "A-101",
    "residentType": "OWNER",
    "isLivingHere": false,
    "ownerOccupancy": "NON_RESIDING_OWNER",
    "submittedAt": "2026-05-20T10:00:00.000Z",
    "approvedAt": null,
    "rejectedAt": null,
    "documents": [],
    "message": "Your request is under review by the society admin",
    "rejectionReason": null,
    "resubmitReason": null,
    "canReapply": false,
    "accessGranted": false
  }
}
```

Possible statuses:

```text
NOT_STARTED
DRAFT
PENDING_DOCS
PENDING_APPROVAL
RESUBMIT_REQUESTED
APPROVED
REJECTED
```

## Admin Review APIs

These are used by society ADMIN or SUPER_ADMIN to review resident join requests.

### List Pending Requests

```http
GET /resident/onboarding/admin/pending
```

Optional query:

```text
status=PENDING_APPROVAL
residentType=OWNER
page=1
limit=20
```

Response shape:

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "request-id",
        "resident": {
          "id": "user-id",
          "name": "Resident Name",
          "phone": "9006412619",
          "email": "resident@example.com",
          "photoUrl": null
        },
        "flat": {
          "flatNumber": "A-101",
          "block": "Tower A"
        },
        "residentType": "OWNER",
        "isLivingHere": false,
        "ownerOccupancy": "NON_RESIDING_OWNER",
        "status": "PENDING_APPROVAL",
        "submittedAt": "2026-05-20T10:00:00.000Z",
        "documentsCount": 2,
        "resubmissionCount": 0
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### Get Request Details

```http
GET /resident/onboarding/admin/:requestId
```

Use this screen to show resident details, flat details, submitted documents, and audit history.

### Approve Request

```http
PATCH /resident/onboarding/admin/:requestId/approve
```

Body:

```json
{
  "notes": "Documents verified"
}
```

Result:

- Request becomes `APPROVED`.
- User becomes active.
- User gets a `UserFlatMembership`.
- User active context becomes the approved society/flat.
- Owner/tenant and `isLivingHere` are saved on membership.

### Reject Request

```http
PATCH /resident/onboarding/admin/:requestId/reject
```

Body:

```json
{
  "reason": "Ownership proof is not clear"
}
```

### Request Resubmission

```http
PATCH /resident/onboarding/admin/:requestId/request-resubmit
```

Body:

```json
{
  "reason": "Please upload a clearer ID proof",
  "documentsToResubmit": ["AADHAR_CARD"]
}
```

## Multi-Flat / Multi-Society Context APIs

After a user is approved for multiple flats, the app can show one combined flat selector.

### Get User Contexts

```http
GET /users/resident-app/contexts
```

Response includes all approved flats/societies/roles for the logged-in user.

Important fields:

```json
{
  "societyId": "society-id",
  "societyName": "Greenfield Heights",
  "flatId": "flat-id",
  "flatNumber": "A-101",
  "blockName": "Tower A",
  "role": "RESIDENT",
  "residentType": "OWNER",
  "isOwner": true,
  "isLivingHere": false,
  "canUseDailyGateFeatures": false
}
```

Frontend behavior:

- Show flat label like `Greenfield Heights - Tower A A-101`.
- When user taps another flat, call switch context.
- Do not build two separate switchers for society and flat.

### Switch Active Flat Context

```http
POST /users/resident-app/switch-context
```

Body:

```json
{
  "membershipId": "membership-id"
}
```

After switching, existing APIs use the selected society/flat from the user's active context.

## Upload Notes

The onboarding submit API accepts documents with `s3Key` or `url`.

Important current backend behavior:

- `/resident/onboarding/request` can save document metadata for users who are not approved yet.
- `/upload/presigned-url` currently uses normal society isolation and may require an already assigned society context.
- For onboarding before approval, the frontend should send an already uploaded `s3Key` or `url`.
- If the frontend needs direct pre-approval uploads, add a dedicated onboarding upload endpoint later using `authenticateForOnboarding`.

For approved users/admin uploads, the existing endpoint is:

```http
POST /upload/presigned-url
```

Body:

```json
{
  "context": "onboarding",
  "fileName": "sale-deed.pdf",
  "mimeType": "application/pdf",
  "fileSize": 245000,
  "documentType": "OWNERSHIP_PROOF"
}
```

Then upload the file to the returned presigned URL and send the returned `s3Key` in `/resident/onboarding/request`.

## Removed / Disabled Flow

Do not use this as a resident app flow:

```http
POST /society-registration/request
```

It now returns a 403-style message because society setup is handled by S-Gate back office/super-admin first.

## Recommended Screens

Back-office/web:

1. Login
2. Society list
3. Create society
4. Society details
5. Blocks/flats manager
6. Onboarding requests list
7. Onboarding request details
8. Approve / reject / request resubmission

Resident app:

1. Login/signup
2. Search city/society
3. Select block/tower
4. Select flat
5. Choose owner/tenant
6. If owner: choose living here or not living here
7. Upload required docs
8. Submit and wait for approval
9. After approval: show flat selector if multiple flats exist
