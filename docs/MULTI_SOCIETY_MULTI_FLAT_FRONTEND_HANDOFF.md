# Multi-Society Multi-Flat Frontend Handoff

This document explains the new backend support for residents who belong to many societies and many flats, while keeping one active app context at a time.

## Core Mental Model

Use these rules everywhere in the frontend:

- `activeContext` controls the home screen.
- `societyId` tells which society a record belongs to.
- `flatIds` tells which flats the request targets.
- Notifications are global to the resident account, not limited to the active society.

Example:

```text
Resident Rahul
Society A: Flat 101, Flat 102
Society B: Flat 11
Society C: Flat 7

Active context: Society C / Flat 7

Still receive:
Society A entry request
Society B entry request
Society C entry request
```

## Resident Context APIs

### Fetch all societies and flats for the logged-in resident

```http
GET /api/v1/users/resident-app/contexts
Authorization: Bearer <resident_token>
```

Use this after login and app launch.

Response shape:

```json
{
  "success": true,
  "data": {
    "activeContext": {
      "membershipId": "membership_1",
      "societyId": "society_c",
      "societyName": "Society C",
      "flatId": "flat_7",
      "flatNumber": "7",
      "blockName": "Tower A",
      "label": "Tower A - 7",
      "role": "RESIDENT",
      "residentType": "OWNER",
      "isActiveContext": true
    },
    "contexts": [],
    "societies": [
      {
        "societyId": "society_a",
        "societyName": "Society A",
        "societyCity": "Mumbai",
        "contexts": []
      }
    ]
  }
}
```

Frontend behavior:

- Show a society switcher from `societies`.
- Show flats inside the selected society from `societies[].contexts`.
- Default to `activeContext`.
- If `activeContext` is null, pick the first/default context from `contexts`.

### Switch active society/flat context

```http
POST /api/v1/users/resident-app/switch-context
Authorization: Bearer <resident_token>
Content-Type: application/json
```

Body:

```json
{
  "membershipId": "membership_1"
}
```

Important:

- Store the new `accessToken` and `refreshToken` returned by this API.
- After switching, refresh home screen data.
- Do not use active context as a filter for the global notification inbox.

## Entry Request APIs

Entry request routes are available under:

```text
/api/v1/gate/entry-requests
/api/v1/gate/requests
```

Both prefixes point to the same backend routes.

### Guard creates a single-flat request

Existing format still works:

```http
POST /api/v1/gate/entry-requests
Authorization: Bearer <guard_token>
Content-Type: application/json
```

```json
{
  "type": "VISITOR",
  "flatId": "flat_101",
  "visitorName": "Amit Kumar",
  "visitorPhone": "9876543210",
  "photoKey": "entry-photos/amit.jpg"
}
```

### Guard creates a multi-flat request

New format:

```json
{
  "type": "VISITOR",
  "flatIds": ["flat_101", "flat_102"],
  "visitorName": "Amit Kumar",
  "visitorPhone": "9876543210",
  "photoKey": "entry-photos/amit.jpg"
}
```

Rules:

- `flatId` or `flatIds` is required.
- `flatIds` can contain up to 20 flats.
- All flats must belong to the guard's society.
- Cross-society requests are not allowed in one request.
- If a visitor needs approval in two societies, create two separate requests.

Response now includes multi-flat display helpers:

```json
{
  "success": true,
  "data": {
    "entryRequest": {
      "id": "entry_request_1",
      "type": "VISITOR",
      "status": "PENDING",
      "societyId": "society_a",
      "flatId": "flat_101",
      "flatIds": ["flat_101", "flat_102"],
      "targetFlats": [
        {
          "id": "flat_101",
          "flatNumber": "101",
          "blockName": "Tower A"
        },
        {
          "id": "flat_102",
          "flatNumber": "102",
          "blockName": "Tower A"
        }
      ],
      "flatLabel": "Tower A 101, Tower A 102",
      "visitorName": "Amit Kumar",
      "expiresAt": "2026-05-27T10:30:00.000Z"
    }
  }
}
```

### Get entry requests

```http
GET /api/v1/gate/entry-requests?status=PENDING&page=1&limit=20
Authorization: Bearer <resident_or_guard_token>
```

For residents:

- Backend returns requests for all flats linked through `UserFlatMembership`.
- This is not limited to the active flat.
- Use `societyId` from each request to decide where it belongs.
- For home screen, filter client-side to active society.
- For notification screen, show all societies.

### Get request detail

```http
GET /api/v1/gate/entry-requests/:id
Authorization: Bearer <resident_token>
```

Important for cross-society notifications:

- Do not send `societyId` in query/body when opening a request from another society.
- Just call by request `id`.
- Backend checks access using the resident's flat memberships.

### Approve request

```http
PATCH /api/v1/gate/entry-requests/:id/approve
Authorization: Bearer <resident_token>
```

Approval rules:

- Resident can approve if they are linked to at least one target flat.
- Active context does not need to match the request society.
- Multi-flat approval creates entry logs for each targeted flat.

### Reject request

```http
PATCH /api/v1/gate/entry-requests/:id/reject
Authorization: Bearer <resident_token>
Content-Type: application/json
```

Body:

```json
{
  "reason": "Not expected"
}
```

## Notification APIs

### Global inbox

```http
GET /api/v1/resident/notifications?page=1&limit=20
Authorization: Bearer <resident_token>
```

This returns all notifications for the resident account.

Important:

- This endpoint is user-scoped.
- It is not restricted to the active society.
- Use `notification.societyId` and `notification.data` to display society/flat context.

### Grouped inbox by society

```http
GET /api/v1/resident/notifications/grouped?page=1&limit=20
Authorization: Bearer <resident_token>
```

Use this for the notification tab.

Response shape:

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "societyId": "society_a",
        "societyName": "Society A",
        "unreadCount": 2,
        "notificationCount": 3,
        "notifications": []
      },
      {
        "societyId": "society_c",
        "societyName": "Society C",
        "unreadCount": 1,
        "notificationCount": 1,
        "notifications": []
      }
    ],
    "pagination": {
      "total": 4,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

### Entry request notification data

New entry request notifications include structured data:

```json
{
  "id": "notification_1",
  "type": "ENTRY_REQUEST",
  "title": "Society A · 2 Flats",
  "message": "Amit Kumar requested entry. Purpose: VISITOR",
  "societyId": "society_a",
  "referenceId": "entry_request_1",
  "referenceType": "EntryRequest",
  "data": {
    "entryRequestId": "entry_request_1",
    "societyId": "society_a",
    "societyName": "Society A",
    "flatIds": ["flat_101", "flat_102"],
    "flatLabels": ["101", "102"],
    "visitorName": "Amit Kumar",
    "purpose": "VISITOR",
    "requestType": "VISITOR",
    "status": "PENDING"
  }
}
```

## Push Notification Behavior

Push notifications are now sent using `UserFlatMembership`.

This means:

- A resident receives pushes for all linked flats.
- A resident active in Society C still receives Society A and Society B requests.
- If one resident is linked to multiple target flats, they receive only one push.

Push data includes:

```json
{
  "type": "GATE_REQUEST",
  "screen": "EntryRequest",
  "requestId": "entry_request_1",
  "entryRequestId": "entry_request_1",
  "societyId": "society_a",
  "flatIds": "flat_101,flat_102"
}
```

Frontend push handling:

1. Read `entryRequestId`.
2. Open `GET /api/v1/gate/entry-requests/:id`.
3. If request society is not active, show society name clearly.
4. Recommended behavior: switch context to that society/flat before opening the detail screen.

## UI Rules

### Home screen

Show only active context data:

- Active society name
- Active flat label
- Pending requests for active society
- Badge count for other societies if global inbox has unread notifications

### Notification tab

Show all societies.

Recommended grouping:

```text
Society A
Flat 101, Flat 102
2 pending requests

Society B
Flat 11
1 pending request
```

### Notification card format

Use this order:

```text
Society Name · Flat Info
Visitor Name wants entry
Purpose: Visit / Delivery / Maintenance / Other
Status: Pending
```

Single flat:

```text
Society A · Flat 101
Amit Kumar requested entry
Purpose: Visit
```

Multiple flats:

```text
Society A · 2 Flats
Flat 101, Flat 102
Amit Kumar requested entry
Purpose: Visit
```

Other society while active in Society C:

```text
New request in Society A
Flats: Flat 101, Flat 102
Visitor: Amit Kumar
```

## Important Edge Cases

- Same resident has multiple flats in same society: show one grouped request if backend returns multiple `targetFlats`.
- Same visitor needs entry in different societies: create separate requests per society.
- Resident has access to society but not target flat: backend will deny approve/reject.
- No active context: show context chooser after login.
- Notification from inactive context: still display it if backend returns it, but request action may fail if membership is no longer active.
- Do not hide notifications only because they are not from the active society.

## Frontend Integration Checklist

- After login, call `/api/v1/users/resident-app/contexts`.
- Build society switcher from `data.societies`.
- Store and use returned tokens after `/switch-context`.
- Use `/api/v1/resident/notifications/grouped` for the notification tab.
- Use notification `data.societyName`, `data.flatLabels`, and `data.entryRequestId`.
- Open request detail by `entryRequestId`.
- Render `targetFlats` and `flatLabel` for multi-flat requests.
- Allow approve/reject even when request society is not the active society.
- Do not pass another society's `societyId` as query/body when opening or approving a notification request.
- Guard UI should send `flatIds` when one visitor/request targets multiple flats.
