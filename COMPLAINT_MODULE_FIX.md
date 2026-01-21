# Complaint Module - Fixed & Enhanced

## Issues Fixed

### 1. **Missing Photo Upload Support**
- Added `images` array field support (up to 5 photos)
- Photos stored as S3 URLs in database
- Admin can view all photos when reviewing complaints

### 2. **No AsyncHandler Wrapper**
- Added proper `asyncHandler` wrapper to all controller methods
- Errors now properly propagated to error middleware

### 3. **Missing Input Validation**
- Added validation for required fields (category, title, description)
- Added validation for image count (max 5)
- Added resolution validation when resolving complaints

### 4. **No Society Isolation**
- Added society isolation checks to all admin operations
- SUPER_ADMIN can see all complaints
- ADMIN can only see complaints in their society
- RESIDENT can only see their own complaints

### 5. **Missing Access Control**
- Added proper RBAC for viewing complaint details
- Only reporter or admin can view complaint photos

---

## API Endpoints

### 1. Create Complaint (Resident)
**POST** `/api/complaints`

**Auth:** Resident or Admin

**Request Body:**
```json
{
  "category": "MAINTENANCE",
  "priority": "HIGH",
  "title": "Broken elevator",
  "description": "Elevator in Block A is not working since yesterday",
  "images": [
    "https://s3.amazonaws.com/bucket/photo1.jpg",
    "https://s3.amazonaws.com/bucket/photo2.jpg"
  ],
  "location": "Block A, Elevator 1",
  "isAnonymous": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Complaint created successfully",
  "data": {
    "id": "uuid",
    "category": "MAINTENANCE",
    "priority": "HIGH",
    "status": "OPEN",
    "title": "Broken elevator",
    "description": "Elevator in Block A is not working",
    "images": ["url1", "url2"],
    "location": "Block A, Elevator 1",
    "isAnonymous": false,
    "reportedBy": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210"
    },
    "flat": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Validations:**
- category, title, description are required
- Max 5 images allowed
- Images must be S3 URLs (uploaded via `/api/upload/presigned-url`)

---

### 2. Get Complaints (Filtered by Role)
**GET** `/api/complaints?category=MAINTENANCE&status=OPEN&page=1&limit=20`

**Auth:** All authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "id": "uuid",
        "category": "MAINTENANCE",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "title": "Broken elevator",
        "reportedBy": { "id": "uuid", "name": "John Doe" },
        "flat": {
          "flatNumber": "A101",
          "block": { "name": "Block A" }
        },
        "assignedTo": { "name": "Admin" },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

**Filtering:**
- **SUPER_ADMIN:** Sees all complaints
- **ADMIN:** Sees all complaints in their society
- **RESIDENT:** Sees only their own complaints

---

### 3. Get Complaint Details (Admin sees photos)
**GET** `/api/complaints/:id`

**Auth:** All authenticated users

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category": "MAINTENANCE",
    "priority": "HIGH",
    "status": "OPEN",
    "title": "Broken elevator",
    "description": "Detailed description...",
    "images": [
      "https://s3.amazonaws.com/bucket/photo1.jpg",
      "https://s3.amazonaws.com/bucket/photo2.jpg"
    ],
    "location": "Block A, Elevator 1",
    "reportedBy": {
      "id": "uuid",
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com"
    },
    "flat": {
      "flatNumber": "A101",
      "block": { "name": "Block A" }
    },
    "assignedTo": null,
    "resolvedBy": null,
    "resolution": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Access Control:**
- **SUPER_ADMIN:** Can view any complaint with photos
- **ADMIN:** Can view complaints in their society with photos
- **RESIDENT:** Can only view their own complaints with photos

---

### 4. Update Complaint Status (Admin)
**PATCH** `/api/complaints/:id/status`

**Auth:** Admin only

**Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Valid Statuses:**
- OPEN
- IN_PROGRESS
- RESOLVED
- CLOSED
- REJECTED

---

### 5. Assign Complaint (Admin)
**PATCH** `/api/complaints/:id/assign`

**Auth:** Admin only

**Request Body:**
```json
{
  "assignedToId": "staff-user-id"
}
```

**Behavior:**
- Auto-changes status to `IN_PROGRESS`
- Sets `assignedAt` timestamp
- Can only assign to users in same society

---

### 6. Resolve Complaint (Admin)
**PATCH** `/api/complaints/:id/resolve`

**Auth:** Admin only

**Request Body:**
```json
{
  "resolution": "Elevator has been repaired. Service technician visited and fixed the motor issue."
}
```

**Behavior:**
- Changes status to `RESOLVED`
- Sets `resolvedById` and `resolvedAt`
- Resolution message is visible to resident

---

### 7. Delete Complaint (Resident)
**DELETE** `/api/complaints/:id`

**Auth:** Resident (complaint reporter only)

**Response:**
```json
{
  "success": true,
  "message": "Complaint deleted successfully"
}
```

**Validations:**
- Only complaint reporter can delete
- Cannot delete resolved complaints

---

## Photo Upload Flow

### Step 1: Upload Photos to S3
```javascript
// 1. Get presigned URL
POST /api/upload/presigned-url
{
  "fileType": "image/jpeg",
  "folder": "complaints"
}

// Response: { uploadUrl, s3Key }

// 2. Upload file to S3 using presigned URL
PUT uploadUrl (from client)
Body: <binary image data>

// 3. Get photo URL
const photoUrl = `https://s3.amazonaws.com/bucket/${s3Key}`;
```

### Step 2: Create Complaint with Photo URLs
```javascript
POST /api/complaints
{
  "category": "MAINTENANCE",
  "title": "Issue",
  "description": "Details",
  "images": [photoUrl1, photoUrl2] // S3 URLs
}
```

---

## Database Schema

```prisma
model Complaint {
  id String @id @default(uuid())

  category ComplaintCategory
  priority ComplaintPriority @default(MEDIUM)
  status   ComplaintStatus   @default(OPEN)

  title       String
  description String

  // Photo evidence (S3 URLs)
  images String[] // Max 5 images

  location String? // "Block A, 3rd floor"

  // Reporter
  reportedById String
  reportedBy   User   @relation(...)
  flatId       String?
  flat         Flat?  @relation(...)
  societyId    String
  society      Society @relation(...)

  // Assignment
  assignedToId String?
  assignedTo   User?     @relation(...)
  assignedAt   DateTime?

  // Resolution
  resolvedById String?
  resolvedBy   User?     @relation(...)
  resolvedAt   DateTime?
  resolution   String?

  isAnonymous Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Security Features

1. **Society Isolation**
   - Admins can only manage complaints in their society
   - Prevents cross-society data access

2. **RBAC**
   - SUPER_ADMIN: Full access to all complaints
   - ADMIN: Society-level access
   - RESIDENT: Only own complaints

3. **Photo Access Control**
   - Photos only visible to reporter and admins
   - S3 URLs stored in database

4. **Input Validation**
   - Required fields checked
   - Image count limited to 5
   - Resolution required when resolving

5. **Delete Protection**
   - Can't delete resolved complaints
   - Only reporter can delete own complaints

---

## Testing

### Test as Resident
1. Upload photos via `/api/upload/presigned-url`
2. Create complaint with photo URLs
3. View own complaints
4. Delete unresolved complaint

### Test as Admin
1. Get all complaints in society
2. View complaint details with photos
3. Assign complaint to staff
4. Update status to IN_PROGRESS
5. Resolve with resolution message

### Test Society Isolation
1. Login as Admin from Society A
2. Try to view complaint from Society B
3. Should get 403 Forbidden error
