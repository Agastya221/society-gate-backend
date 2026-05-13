# Society Onboarding Flow

This document has two flows:

1. Resident joins an existing society.
2. User registers a new society for super-admin approval.

## 1. Resident Onboarding Into Existing Society

```mermaid
flowchart TD
    A[User signs up / logs in with OTP] --> B[User has onboarding token]
    B --> C[Search active societies]
    C --> D{Society found?}

    D -- Yes --> E[Select society]
    E --> F[Load blocks / towers]
    F --> G[Select block]
    G --> H[Load flats]
    H --> I[Select flat]
    I --> J[Choose resident type: OWNER or TENANT]

    J --> K[Upload required documents]
    K --> L{Document rules pass?}
    L -- No --> M[Show validation error]
    M --> K

    L -- Yes --> N[Submit onboarding request]
    N --> O[Status: PENDING_APPROVAL]
    O --> P[Society admin reviews request]

    P --> Q{Admin decision}
    Q -- Approve --> R[Status: APPROVED]
    R --> S[Activate user]
    S --> T[Assign society, flat, owner/tenant flag]
    T --> U[Resident gets full app access]

    Q -- Reject --> V[Status: REJECTED]
    V --> W[Resident can see rejection reason]
    W --> X[Resident may reapply]

    Q -- Request resubmit --> Y[Status: RESUBMIT_REQUESTED]
    Y --> Z[Resident sees resubmit reason]
    Z --> K

    D -- No --> AA[Use society registration flow]
```

## Resident Onboarding API Sequence

```mermaid
sequenceDiagram
    actor Resident
    participant App
    participant API
    participant Admin

    Resident->>App: Open onboarding
    App->>API: GET /api/v1/resident/onboarding/societies
    API-->>App: Active societies
    App->>API: GET /api/v1/resident/onboarding/societies/:societyId/blocks
    API-->>App: Blocks
    App->>API: GET /api/v1/resident/onboarding/societies/:societyId/blocks/:blockId/flats
    API-->>App: Flats
    Resident->>App: Select flat, owner/tenant, upload documents
    App->>API: POST /api/v1/resident/onboarding/request
    API-->>App: PENDING_APPROVAL

    Admin->>API: GET /api/v1/resident/onboarding/admin/pending
    API-->>Admin: Pending requests
    Admin->>API: GET /api/v1/resident/onboarding/admin/:requestId
    API-->>Admin: Request details + documents

    alt Approved
        Admin->>API: PATCH /api/v1/resident/onboarding/admin/:requestId/approve
        API-->>Resident: Status APPROVED
    else Rejected
        Admin->>API: PATCH /api/v1/resident/onboarding/admin/:requestId/reject
        API-->>Resident: Status REJECTED + reason
    else Resubmission needed
        Admin->>API: PATCH /api/v1/resident/onboarding/admin/:requestId/request-resubmit
        API-->>Resident: Status RESUBMIT_REQUESTED + reason
    end

    Resident->>API: GET /api/v1/resident/onboarding/status
    API-->>Resident: Current onboarding status
```

## 2. New Society Registration Flow

Use this when the resident cannot find their society in the onboarding list.

```mermaid
flowchart TD
    A[Authenticated user cannot find society] --> B[Fill society registration form]
    B --> C[Submit registration request]
    C --> D[Status: PENDING]
    D --> E[Super admin reviews request]
    E --> F{Super admin decision}

    F -- Approve --> G[Create Society row]
    G --> H[Make requester ADMIN]
    H --> I[Set requester societyId]
    I --> J[Activate admin user]
    J --> K[Request status: APPROVED]
    K --> L[Admin can configure blocks, flats, guards, etc.]

    F -- Reject --> M[Request status: REJECTED]
    M --> N[User sees rejection reason]
    N --> O[User can submit corrected request]
```

## New Society Registration API Sequence

```mermaid
sequenceDiagram
    actor User
    participant App
    participant API
    participant SuperAdmin

    User->>App: Society not found
    User->>App: Enter society details
    App->>API: POST /api/v1/society-registration/request
    API-->>App: Request PENDING

    User->>API: GET /api/v1/society-registration/my-status
    API-->>User: Current request status

    SuperAdmin->>API: GET /api/v1/society-registration/requests?status=PENDING
    API-->>SuperAdmin: Pending society registrations
    SuperAdmin->>API: GET /api/v1/society-registration/requests/:id
    API-->>SuperAdmin: Request details

    alt Approved
        SuperAdmin->>API: POST /api/v1/society-registration/requests/:id/approve
        API-->>SuperAdmin: Society created, requester promoted to ADMIN
    else Rejected
        SuperAdmin->>API: POST /api/v1/society-registration/requests/:id/reject
        API-->>SuperAdmin: Request rejected with reason
    end
```

## Mind Map Outline

```text
Society Onboarding
├── Resident joins existing society
│   ├── OTP signup/login
│   ├── Search society
│   ├── Select block/tower
│   ├── Select flat
│   ├── Choose OWNER or TENANT
│   ├── Upload documents
│   │   ├── OWNER: ownership proof required
│   │   ├── TENANT: tenant agreement required
│   │   └── Both: at least one ID proof required
│   ├── Submit request
│   ├── Admin review
│   │   ├── Approve
│   │   ├── Reject
│   │   └── Request resubmission
│   └── Final access
│       ├── Approved: active resident
│       ├── Rejected: can reapply
│       └── Resubmit: upload corrected docs
└── New society registration
    ├── Society not found
    ├── Submit society details
    ├── Super admin review
    │   ├── Approve
    │   └── Reject
    └── Approval result
        ├── Society created
        ├── Requester becomes ADMIN
        └── Admin configures society data
```

## Status Values

Resident onboarding:

- `NOT_STARTED`
- `DRAFT`
- `PENDING_DOCS`
- `PENDING_APPROVAL`
- `RESUBMIT_REQUESTED`
- `APPROVED`
- `REJECTED`

Society registration:

- `NOT_SUBMITTED`
- `PENDING`
- `APPROVED`
- `REJECTED`

