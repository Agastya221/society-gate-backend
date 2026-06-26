# Super Admin Web Console API Handoff

Base URL: `https://society-gate-backend-gsrq.onrender.com/api/v1`

All endpoints require an access token for a user with `role: SUPER_ADMIN`:

```http
Authorization: Bearer <accessToken>
```

## Money Terms

- **Sales / Platform revenue**: money societies owe/pay to S-Gate for using the software. This comes from `Society.monthlyFee`, `paymentStatus`, `lastPaidDate`, and `nextDueDate`.
- **Collections**: resident maintenance/invoice money flowing through societies via invoices and Cashfree transactions. This is not the same as S-Gate revenue.

## Dashboard

### `GET /superadmin/overview`

Returns global KPIs:

- societies total/active/inactive
- societies by payment and onboarding status
- users by role
- pending society and resident approvals
- today entries, open complaints, active emergencies
- platform MRR
- successful resident collections and pending invoice amount

## Societies

### `GET /superadmin/societies`

Query params:

- `page`, `limit`
- `search`
- `city`
- `isActive=true|false`
- `paymentStatus=PENDING|PAID|OVERDUE`
- `onboardingStatus=LEAD|PROFILE_CREATED|DOCS_PENDING|PENDING_VERIFICATION|VERIFIED|IMPORT_PENDING|CONFIG_PENDING|ACTIVE|REJECTED`

### `GET /superadmin/societies/:id`

Returns full society profile with blocks, recent users, counts, invoice/payment summaries, open complaints, and active emergencies.

### `PATCH /superadmin/societies/:id/status`

Body:

```json
{
  "status": "SUSPENDED",
  "reason": "Payment overdue"
}
```

Allowed `status`: `ACTIVE`, `SUSPENDED`, `DEACTIVATED`.

This writes a platform audit log.

### `PATCH /superadmin/societies/:id`

Full-control society edit. Send only fields that should change plus optional `reason`.

```json
{
  "name": "New Society Name",
  "monthlyFee": 1000,
  "reason": "Updated commercial plan"
}
```

This writes a platform audit log.

## Users

### `GET /superadmin/users`

Query params:

- `page`, `limit`
- `search`
- `role=SUPER_ADMIN|ADMIN|GUARD|RESIDENT`
- `isActive=true|false`
- `societyId`

### `GET /superadmin/users/:id`

Returns a user with current society/flat, all flat memberships, and recent onboarding requests.

### `PATCH /superadmin/users/:id/status`

Body:

```json
{
  "isActive": false,
  "reason": "Fraud review"
}
```

This writes a platform audit log. A Super Admin cannot disable their own account.

## Approvals

### `GET /superadmin/onboarding/resident-requests`

Query params:

- `page`, `limit`
- `search`
- `status=DRAFT|PENDING_DOCS|PENDING_APPROVAL|RESUBMIT_REQUESTED|APPROVED|REJECTED`
- `societyId`

### `GET /superadmin/onboarding/society-requests`

Query params:

- `page`, `limit`
- `search`
- `status=PENDING|APPROVED|REJECTED`

Use existing approval endpoints for society registration actions:

- `POST /society-registration/requests/:id/approve`
- `POST /society-registration/requests/:id/reject`

## Sales

### `GET /superadmin/sales`

Query params:

- `societyId`
- `from`, `to` filter by society `nextDueDate`

Returns platform revenue summary, paid/overdue values, payment-status breakdown, and upcoming unpaid societies.

## Collections

### `GET /superadmin/collections`

Query params:

- `societyId`
- `from`, `to` filter invoices and payment transactions by `createdAt`

Returns invoice status totals, Cashfree transaction status totals, recent payment failures, and top paid societies.

## Activity / Audit Logs

### `GET /superadmin/activity`

Query params:

- `page`, `limit`
- `search`
- `action`
- `targetType`
- `actorUserId`

Shows Super Admin actions such as `SOCIETY_UPDATED`, `SOCIETY_SUSPENDED`, `USER_DISABLED`, etc.
