# Family Member Feature

## Overview
Allows primary residents to invite and manage up to 6 family members per flat.

## Schema Changes

### New Enum: FamilyRole
```prisma
enum FamilyRole {
  SPOUSE
  CHILD
  PARENT
  SIBLING
  OTHER
}
```

### User Model Updates
```prisma
model User {
  // ... existing fields

  // Family member fields
  isPrimaryResident Boolean     @default(false) // One primary per flat
  familyRole        FamilyRole? // SPOUSE, CHILD, PARENT, SIBLING, OTHER
  primaryResidentId String?     // Reference to primary resident
  primaryResident   User?       @relation("FamilyMembers", fields: [primaryResidentId], references: [id])
  familyMembers     User[]      @relation("FamilyMembers")
}
```

## Business Rules

1. **Maximum 6 family members per flat** (including primary resident)
2. **Primary resident** is automatically set when onboarding is approved (first resident for that flat)
3. **Only primary residents** can invite/remove/update family members
4. **Family members** must verify OTP to activate their account
5. **Primary resident cannot remove themselves**

## API Endpoints

### 1. Invite Family Member
**POST** `/api/family/invite`

**Auth:** Resident App (Primary resident only)

**Request Body:**
```json
{
  "phone": "+919876543210",
  "name": "John Doe",
  "email": "john@example.com",
  "familyRole": "SPOUSE"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Family member invited successfully. They need to verify OTP to activate account.",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john@example.com",
    "isPrimaryResident": false,
    "familyRole": "SPOUSE",
    "isActive": false
  }
}
```

**Validations:**
- Primary resident must be active
- Flat must have less than 6 members
- Phone number must be unique

---

### 2. Get Family Members
**GET** `/api/family`

**Auth:** Resident App

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Primary Resident",
      "phone": "+919111111111",
      "email": "primary@example.com",
      "photoUrl": null,
      "isActive": true,
      "isPrimaryResident": true,
      "familyRole": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com",
      "photoUrl": null,
      "isActive": true,
      "isPrimaryResident": false,
      "familyRole": "SPOUSE",
      "createdAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

---

### 3. Remove Family Member
**DELETE** `/api/family/:memberId`

**Auth:** Resident App (Primary resident only)

**Response:**
```json
{
  "success": true,
  "message": "Family member removed successfully"
}
```

**Validations:**
- Only primary resident can remove members
- Cannot remove primary resident
- Can only remove members from same flat

---

### 4. Update Family Role
**PATCH** `/api/family/:memberId/role`

**Auth:** Resident App (Primary resident only)

**Request Body:**
```json
{
  "familyRole": "CHILD"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Family role updated successfully",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "phone": "+919876543210",
    "familyRole": "CHILD"
  }
}
```

---

## User Flow

### For Primary Resident

1. **Complete onboarding** → Automatically becomes primary resident
2. **Invite family member:**
   - Call `POST /api/family/invite`
   - System creates inactive user with family details
3. **View family members:** `GET /api/family`
4. **Manage family:**
   - Update roles: `PATCH /api/family/:memberId/role`
   - Remove members: `DELETE /api/family/:memberId`

### For Family Member

1. **Receive invitation** (primary resident adds their phone)
2. **Request OTP:** `POST /api/auth/otp/send`
3. **Verify OTP:** `POST /api/auth/otp/verify`
   - System detects invited family member
   - Activates account automatically
   - Returns token
4. **Login complete** - Access full app features

---

## Database Flow

### Onboarding Approval (Sets Primary Resident)
```typescript
// In onboardingService.approveRequest()
const existingResidents = await tx.user.count({
  where: {
    flatId: request.flatId,
    isActive: true,
    role: 'RESIDENT',
  },
});

const isPrimaryResident = existingResidents === 0; // First resident

await tx.user.update({
  where: { id: request.userId },
  data: {
    isPrimaryResident, // true if first resident
    // ... other fields
  },
});
```

### Family Member Activation (OTP Verify)
```typescript
// In userService.verifyOtpAndCreateProfile()
if (!user.isActive && user.flatId && user.primaryResidentId) {
  user = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: true }, // Activate family member
  });
}
```

---

## Error Cases

| Error | Status | Message |
|-------|--------|---------|
| Not primary resident | 403 | "Only primary residents can invite family members" |
| Max members reached | 400 | "Maximum 6 family members allowed per flat" |
| Phone exists | 400 | "Phone number already registered" |
| Remove self | 400 | "Primary resident cannot remove themselves" |
| Remove primary | 400 | "Cannot remove primary resident" |
| Different flat | 403 | "Can only remove family members from your own flat" |

---

## Testing

### Test Credentials (After Seed)
**Primary Resident (A101):**
- Phone: +919111111111
- Password: password123

**To Test:**
1. Login as primary resident
2. Invite family member with new phone number
3. Family member verifies OTP
4. View family list
5. Update/remove family members

---

## Future Enhancements

1. Family member approval workflow (primary must approve before activation)
2. Family member permissions (restrict certain features)
3. Family member age restrictions
4. Primary resident transfer functionality
5. Family member notifications
