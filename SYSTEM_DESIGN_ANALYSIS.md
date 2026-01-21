# Society Gate Backend - System Design Analysis

## 📋 Executive Summary

This document provides a comprehensive analysis of the **Society Gate Management System** backend architecture, focusing on:
1. **Resident Login & Authentication System**
2. **Society Association Mechanism**
3. **Tenant/Owner Registration Process**
4. **Document Verification (Owner Proof & Tenant Agreement)**
5. **Admin Approval Workflow**

---

## 🏗️ System Architecture Overview

### Multi-Tenant Architecture
The system uses a **multi-tenant SaaS architecture** where:
- Each **Society** is an isolated tenant
- All data is scoped by `societyId` to ensure data isolation
- Multiple societies can use the same platform independently

### Key Design Pattern: **Invitation-Based Onboarding**
The system uses an **invitation code system** to ensure that only authorized residents can register for a specific society and flat.

---

## 🔐 1. Resident Login & Authentication System

### Authentication Methods

#### **Method 1: OTP-Based Login (Primary for Residents)**

**Flow:**
```
1. User enters phone number
2. System sends 6-digit OTP via SMS (MSG91 integration)
3. User verifies OTP
4. System creates/logs in user
5. JWT token issued
```

**Implementation:**
- **File:** `src/modules/user/user.service.ts`
- **Methods:**
  - `requestResidentOtp()` - Sends OTP with rate limiting
  - `verifyOtpAndLoginResident()` - Verifies OTP and creates/logs in user

**Rate Limiting:**
- Max 3 OTP requests per phone number per hour
- Max 5 OTP requests per IP address per hour
- OTP expires in 2 minutes

**Code Reference:**
```typescript
// Lines 33-55: OTP Request
async requestResidentOtp(phone: string, ip: string) {
  // Rate limiting checks
  // Generate 6-digit OTP
  // Store in Redis with 2-minute TTL
  // Send via MSG91
}

// Lines 60-95: OTP Verification & Login
async verifyOtpAndLoginResident(phone: string, otp: string) {
  // Verify OTP
  // Create user if doesn't exist (role: RESIDENT)
  // Generate JWT token
  // Return: { token, user, requiresOnboarding: !user.societyId }
}
```

**Important:** After OTP login, if `requiresOnboarding: true`, the user must complete Phase 2 (Invitation Onboarding).

---

#### **Method 2: Password-Based Login (Admin/Residents)**

**Flow:**
```
1. User enters email/phone + password
2. System verifies credentials
3. JWT token issued
```

**Implementation:**
- **File:** `src/modules/user/user.service.ts`
- **Method:** `residentAppLogin()` (Lines 156-191)

**Supports:**
- Email-based login
- Phone-based login
- Bcrypt password hashing

---

### JWT Token Structure

**Token Payload:**
```typescript
{
  userId: string,
  role: 'RESIDENT' | 'ADMIN' | 'GUARD' | 'SUPER_ADMIN',
  societyId: string | null,
  flatId: string | null,
  appType: 'RESIDENT_APP' | 'GUARD_APP'
}
```

**Middleware:**
- `authenticateResidentApp` - Validates token for resident app
- `authenticateGuardApp` - Validates token for guard app
- `authorize(roles)` - Role-based access control

---

## 🏢 2. How Residents Know Which Society They Belong To

### **Invitation-Based Society Association**

The system uses a **two-phase onboarding process**:

### **Phase 1: OTP Login (User Creation)**
```
User enters phone → OTP sent → OTP verified → User created
```
**User State:**
- `societyId: null`
- `flatId: null`
- `requiresOnboarding: true`

### **Phase 2: Invitation Onboarding (Society Association)**
```
User enters invitation code → System validates → User linked to society & flat
```

---

### **Invitation System Design**

**Database Model:** `Invitation` (Lines 328-367 in schema.prisma)

```prisma
model Invitation {
  id            String            @id @default(uuid())
  code          String            @unique  // e.g., "INV-ABC123"
  
  // Target flat & society
  flatId        String
  flat          Flat              @relation(...)
  societyId     String
  society       Society           @relation(...)
  
  // Resident details (optional pre-fill by admin)
  residentName  String?
  residentPhone String?
  isOwner       Boolean           @default(false)  // Owner or Tenant
  
  // Status
  status        InvitationStatus  @default(PENDING)
  isUsed        Boolean           @default(false)
  usedAt        DateTime?
  usedByPhone   String?
  
  // Validity
  expiresAt     DateTime          // Default: 7 days
  
  // Created by admin
  createdById   String
  createdBy     User              @relation(...)
  
  notes         String?           // Admin notes
}
```

---

### **How Invitation Works**

#### **Step 1: Admin Creates Invitation**

**Current Gap:** ❌ **No API endpoint exists for creating invitations**

**Expected Implementation:**
```typescript
// MISSING: Should be in society.service.ts or separate invitation.service.ts
async createInvitation(adminId: string, data: {
  flatId: string,
  societyId: string,
  residentName?: string,
  residentPhone?: string,
  isOwner: boolean,  // true = Owner, false = Tenant
  notes?: string
}) {
  // Generate unique code (e.g., INV-ABC123)
  const code = generateInvitationCode();
  
  // Set expiry (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  // Create invitation
  const invitation = await prisma.invitation.create({
    data: {
      code,
      flatId: data.flatId,
      societyId: data.societyId,
      residentName: data.residentName,
      residentPhone: data.residentPhone,
      isOwner: data.isOwner,
      expiresAt,
      createdById: adminId,
      notes: data.notes
    }
  });
  
  return invitation;
}
```

**Admin shares this code with the resident** (via SMS, WhatsApp, email, etc.)

---

#### **Step 2: Resident Uses Invitation Code**

**Two Options:**

##### **Option A: OTP Login + Invitation (Recommended)**

**File:** `src/modules/user/user.service.ts` (Lines 100-151)

```typescript
async onboardResidentWithInvitation(userId: string, invitationCode: string) {
  // 1. Validate invitation
  const invitation = await prisma.invitation.findUnique({
    where: { code: invitationCode }
  });
  
  if (!invitation) throw new AppError('Invalid invitation code', 400);
  if (invitation.isUsed) throw new AppError('Invitation already used', 400);
  if (invitation.expiresAt < new Date()) {
    throw new AppError('Invitation expired', 400);
  }
  
  // 2. Check user not already onboarded
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user.societyId) throw new AppError('User already onboarded', 400);
  
  // 3. Update user with society & flat
  const updatedUser = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        societyId: invitation.societyId,
        flatId: invitation.flatId,
        isOwner: invitation.isOwner,  // ✅ Owner or Tenant flag set here
        isActive: true
      }
    });
    
    // 4. Mark invitation as used
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { isUsed: true, usedAt: new Date() }
    });
    
    return u;
  });
  
  // 5. Generate new token with society & flat
  const token = generateToken(
    updatedUser.id,
    updatedUser.role,
    updatedUser.societyId,
    updatedUser.flatId,
    'RESIDENT_APP'
  );
  
  return { token, user: updatedUser };
}
```

**Flow:**
```
1. User logs in with OTP → Gets basic token (no society)
2. User enters invitation code → System validates
3. User linked to society & flat → New token issued with society access
```

---

##### **Option B: Register with Invitation (All-in-One)**

**File:** `src/modules/user/user.service.ts` (Lines 245-305)

```typescript
async residentAppRegister(data: {
  name: string,
  phone: string,
  email?: string,
  password: string,
  invitationCode: string
}) {
  // 1. Validate invitation (same as above)
  const invitation = await prisma.invitation.findUnique({
    where: { code: data.invitationCode }
  });
  
  // Validation checks...
  
  // 2. Create user with society & flat in one step
  const resident = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        role: 'RESIDENT',
        societyId: invitation.societyId,
        flatId: invitation.flatId,
        isOwner: invitation.isOwner,  // ✅ Owner or Tenant flag
        isActive: true
      }
    });
    
    // Mark invitation as used
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { isUsed: true, usedAt: new Date() }
    });
    
    return newUser;
  });
  
  return { token, user: resident };
}
```

**Flow:**
```
1. User provides: name, phone, password, invitationCode
2. System validates invitation
3. User created with society & flat already linked
4. Token issued with full access
```

---

## 👥 3. Tenant vs Owner Registration

### **How the System Distinguishes Tenant from Owner**

**Database Field:** `User.isOwner` (Boolean)

```prisma
model User {
  id       String  @id @default(uuid())
  name     String
  phone    String  @unique
  role     Role    // RESIDENT, ADMIN, GUARD, SUPER_ADMIN
  
  // Resident specific
  flatId   String?
  flat     Flat?   @relation(...)
  isOwner  Boolean @default(false)  // ✅ true = Owner, false = Tenant
  
  societyId String?
  society   Society? @relation(...)
}
```

### **How It's Set**

The `isOwner` flag is set during invitation creation by the admin:

```typescript
// Admin creates invitation for OWNER
const ownerInvitation = await createInvitation({
  flatId: "flat-123",
  societyId: "society-456",
  isOwner: true,  // ✅ Owner
  residentName: "John Doe"
});

// Admin creates invitation for TENANT
const tenantInvitation = await createInvitation({
  flatId: "flat-123",
  societyId: "society-456",
  isOwner: false,  // ✅ Tenant
  residentName: "Jane Smith"
});
```

When the resident uses the invitation code, the `isOwner` value is copied from the invitation to the user record.

---

## 📄 4. Owner Proof & Tenant Agreement Documents

### **Current Implementation: ❌ NOT IMPLEMENTED**

The system **does not currently have** a document verification system for:
- Owner proof (property documents)
- Tenant agreements
- ID proofs for residents

### **Recommended Implementation**

#### **Database Schema Addition**

```prisma
model ResidentDocument {
  id        String   @id @default(uuid())
  
  userId    String
  user      User     @relation(...)
  
  societyId String
  society   Society  @relation(...)
  
  flatId    String
  flat      Flat     @relation(...)
  
  // Document details
  documentType  DocumentType  // OWNER_PROOF, TENANT_AGREEMENT, ID_PROOF, etc.
  documentUrl   String        // S3/Cloudinary URL
  documentName  String
  
  // Verification
  isVerified    Boolean       @default(false)
  verifiedAt    DateTime?
  verifiedById  String?       // Admin who verified
  verifiedBy    User?         @relation(...)
  
  rejectionReason String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum DocumentType {
  OWNER_PROOF          // Property deed, sale agreement
  TENANT_AGREEMENT     // Rental agreement
  AADHAR_CARD
  PAN_CARD
  PASSPORT
  DRIVING_LICENSE
  OTHER
}
```

#### **Suggested API Endpoints**

```typescript
// Upload document
POST /api/residents/documents
Body: {
  documentType: "OWNER_PROOF" | "TENANT_AGREEMENT",
  documentUrl: "https://storage.example.com/doc.pdf",
  documentName: "Property_Deed.pdf"
}

// Admin: Get pending documents for verification
GET /api/admin/documents/pending

// Admin: Verify document
PATCH /api/admin/documents/:id/verify

// Admin: Reject document
PATCH /api/admin/documents/:id/reject
Body: {
  rejectionReason: "Document not clear"
}

// Resident: Get my documents
GET /api/residents/documents
```

---

## ✅ 5. Admin Approval Workflow

### **Current Implementation**

The system has **partial admin approval** implemented:

### **What Requires Admin Approval:**

#### ✅ **1. Invitation Creation (Manual Process)**
- Admin creates invitation for a specific flat
- Admin decides if resident is owner or tenant
- Admin sets invitation expiry

#### ✅ **2. Gate Passes**
**File:** `src/modules/gatepass/`

```typescript
// Resident requests gate pass
POST /api/gatepasses
{
  type: "MOVE_IN" | "MOVE_OUT" | "MATERIAL" | "VEHICLE",
  title: "Moving furniture",
  flatId: "...",
  validFrom: "2026-01-15",
  validUntil: "2026-01-15"
}

// Admin approves
PATCH /api/gatepasses/:id/approve

// Admin rejects
PATCH /api/gatepasses/:id/reject
```

#### ✅ **3. Amenity Bookings**
**File:** `src/modules/amenity/`

```typescript
// Resident books amenity
POST /api/amenities/bookings

// Admin approves
PATCH /api/amenities/bookings/:id/approve
```

#### ✅ **4. Complaints**
**File:** `src/modules/complaint/`

```typescript
// Resident files complaint
POST /api/complaints

// Admin assigns to staff
PATCH /api/complaints/:id/assign

// Admin resolves
PATCH /api/complaints/:id/resolve
```

---

### **What's MISSING: Resident Approval Workflow**

#### ❌ **Document Verification**
- No system to upload owner proof or tenant agreement
- No admin approval for documents

#### ❌ **Resident Activation**
- Currently, residents are auto-activated after using invitation
- Should have: Admin reviews documents → Approves/Rejects → Activates account

---

### **Recommended Resident Approval Workflow**

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: INVITATION                                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Admin creates invitation for flat                        │
│    - Specifies: Owner or Tenant                             │
│    - Generates unique code (e.g., INV-ABC123)               │
│ 2. Admin shares code with resident                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: REGISTRATION                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Resident enters phone number                             │
│ 2. OTP sent and verified                                    │
│ 3. Resident enters invitation code                          │
│ 4. User created with:                                       │
│    - societyId, flatId, isOwner (from invitation)           │
│    - isActive: false (pending approval)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: DOCUMENT UPLOAD (RECOMMENDED TO ADD)               │
├─────────────────────────────────────────────────────────────┤
│ 1. Resident uploads documents:                              │
│    - If Owner: Property deed, ID proof                      │
│    - If Tenant: Rental agreement, ID proof                  │
│ 2. Documents stored in cloud (S3/Cloudinary)                │
│ 3. Status: Pending Verification                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: ADMIN APPROVAL (RECOMMENDED TO ADD)                │
├─────────────────────────────────────────────────────────────┤
│ 1. Admin views pending residents                            │
│ 2. Admin reviews documents                                  │
│ 3. Admin decision:                                          │
│    ✅ APPROVE → User.isActive = true                        │
│    ❌ REJECT → User.isActive = false + rejection reason     │
│ 4. Notification sent to resident                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: ACTIVE RESIDENT                                    │
├─────────────────────────────────────────────────────────────┤
│ Resident can now:                                           │
│ - Create visitor entries                                    │
│ - Book amenities                                            │
│ - File complaints                                           │
│ - Access all resident features                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 System Design Summary

### **Architecture Pattern: Multi-Tenant SaaS**
- Each society is an isolated tenant
- Data scoped by `societyId`
- Role-based access control (RBAC)

### **Authentication: Hybrid Approach**
- **OTP-based** (Primary for residents & guards)
- **Password-based** (Admin & optional for residents)
- **JWT tokens** with role and society context

### **Onboarding: Invitation-Based**
- Admin creates invitation → Resident uses code → Linked to society & flat
- Ensures only authorized residents can join
- Prevents unauthorized registrations

### **Tenant/Owner Distinction**
- Controlled by `User.isOwner` boolean flag
- Set during invitation creation by admin
- No separate registration flows

### **Document Verification: ❌ NOT IMPLEMENTED**
- **Gap:** No system for uploading/verifying documents
- **Recommendation:** Add document management module

### **Admin Approval: PARTIAL**
- ✅ Gate passes, amenity bookings, complaints
- ❌ Resident document verification
- ❌ Resident account activation workflow

---

## 🚀 Recommended Improvements

### **1. Add Invitation Management API**
```typescript
POST   /api/invitations              // Create invitation (Admin)
GET    /api/invitations              // List invitations (Admin)
GET    /api/invitations/:code        // Validate invitation code (Public)
DELETE /api/invitations/:id          // Cancel invitation (Admin)
PATCH  /api/invitations/:id/resend   // Resend invitation (Admin)
```

### **2. Add Document Management Module**
```typescript
POST   /api/residents/documents              // Upload document
GET    /api/residents/documents              // Get my documents
GET    /api/admin/documents/pending          // Pending documents (Admin)
PATCH  /api/admin/documents/:id/verify       // Verify document (Admin)
PATCH  /api/admin/documents/:id/reject       // Reject document (Admin)
```

### **3. Add Resident Approval Workflow**
```typescript
GET    /api/admin/residents/pending          // Pending residents (Admin)
PATCH  /api/admin/residents/:id/approve      // Approve resident (Admin)
PATCH  /api/admin/residents/:id/reject       // Reject resident (Admin)
```

### **4. Add Notification System**
- Email/SMS notifications for:
  - Invitation sent
  - Document uploaded
  - Account approved/rejected
  - OTP codes

---

## 📊 Database Relationships

```
Society (1) ──────────── (N) Flat
   │                          │
   │                          │
   ├─────────────────────────┤
   │                          │
   │                          │
(N) User                      │
   │                          │
   │                          │
   └──────────────────────────┘
   
Invitation:
- Created by: Admin (User)
- For: Flat + Society
- Used by: Resident (User)
- Sets: isOwner flag

User:
- societyId → Which society they belong to
- flatId → Which flat they live in
- isOwner → Owner (true) or Tenant (false)
- role → RESIDENT, ADMIN, GUARD, SUPER_ADMIN
```

---

## 🔒 Security Features

### **1. Multi-Tenant Isolation**
- All queries filtered by `societyId`
- Middleware enforces society access control

### **2. Rate Limiting**
- OTP requests limited per phone and IP
- Prevents abuse

### **3. Invitation Expiry**
- Invitations expire after 7 days
- Single-use codes

### **4. Role-Based Access Control**
- `authorize()` middleware checks user role
- Admin-only endpoints protected

### **5. Password Security**
- Bcrypt hashing (10 rounds)
- No plain text passwords stored

---

## 📝 Conclusion

The **Society Gate Backend** implements a robust **invitation-based onboarding system** that ensures:
- ✅ Only authorized residents can register
- ✅ Residents are automatically linked to correct society and flat
- ✅ Clear distinction between owners and tenants
- ✅ Multi-tenant data isolation

**Key Gaps:**
- ❌ No document verification system
- ❌ No admin approval workflow for residents
- ❌ No invitation management API

**Overall Design:** Well-architected for a society management system with room for enhancement in document verification and approval workflows.

---

**Generated:** January 13, 2026  
**Version:** 1.0  
**Author:** System Analysis
