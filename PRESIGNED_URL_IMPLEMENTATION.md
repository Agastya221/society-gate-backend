# Presigned Image URL Implementation for Complaints

## Overview
Successfully implemented presigned image URL generation for the complaint service to enable mobile apps to view images stored in private S3 buckets.

---

## Problem Statement

### Before Implementation
- ✅ Images upload to S3 correctly
- ✅ S3 keys stored in database (e.g., `entry-photos/user-id/timestamp-filename.png`)
- ❌ Mobile app cannot view images because API only returns S3 keys
- ❌ S3 bucket is private, so direct access using S3 keys doesn't work

### Root Cause
The API was returning raw S3 keys (file paths) without generating time-limited presigned URLs that grant temporary access to view the images.

---

## Solution Implemented

### Changes Made to [src/modules/complaint/complaint.service.ts](src/modules/complaint/complaint.service.ts)

#### 1. Added Import
```typescript
import { getPresignedViewUrl } from '../../utils/s3';
```

#### 2. Added Helper Method
```typescript
/**
 * Generate presigned view URLs for complaint images
 */
private async generateImageUrls(images: string[]): Promise<{ s3Key: string; viewUrl: string }[]> {
  if (!images || images.length === 0) return [];

  const results = await Promise.all(
    images.map(async (s3Key) => {
      try {
        // Skip local file paths (legacy data)
        if (s3Key.startsWith('file://') || s3Key.startsWith('content://')) {
          console.warn(`Skipping local file path: ${s3Key}`);
          return null;
        }
        const viewUrl = await getPresignedViewUrl(s3Key, 3600); // 1 hour expiry
        return { s3Key, viewUrl };
      } catch (error) {
        console.error(`Failed to generate URL for ${s3Key}:`, error);
        return null;
      }
    })
  );

  return results.filter(Boolean) as { s3Key: string; viewUrl: string }[];
}
```

**Features:**
- Generates presigned URLs with 1-hour expiry
- Handles legacy local file paths gracefully (skips them)
- Error handling for each image (one failure doesn't break others)
- Filters out failed generations

#### 3. Updated `getComplaintById` Method
```typescript
// Generate view URLs for images
const imageUrls = await this.generateImageUrls(complaint.images || []);

return {
  ...complaint,
  imageUrls,
};
```

**Behavior:**
- Generates presigned URLs for all images
- Adds `imageUrls` array to response
- Original `images` field (S3 keys) remains unchanged

#### 4. Updated `getComplaints` Method
```typescript
return {
  complaints: complaints.map(c => ({
    ...c,
    imageCount: c.images?.length || 0,
    hasImages: (c.images?.length || 0) > 0,
  })),
  pagination: {
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  },
};
```

**Behavior:**
- Adds `imageCount` field (number of images)
- Adds `hasImages` boolean flag
- No presigned URLs in list view (performance optimization)
- Presigned URLs only generated when viewing individual complaint

---

## API Response Examples

### GET `/api/v1/resident/complaints/:id` (Detail View)

**Before:**
```json
{
  "success": true,
  "data": {
    "id": "cm6sqxvh10001hn21ebpkc6kq",
    "title": "Water leakage in bathroom",
    "description": "...",
    "images": [
      "entry-photos/b3e01da9-9eb3-4c8a-94d8-30462918241f/1769428982121-889a59f0.png"
    ],
    "reportedBy": {...},
    "flat": {...}
  }
}
```
❌ Mobile app cannot view images using S3 keys

**After:**
```json
{
  "success": true,
  "data": {
    "id": "cm6sqxvh10001hn21ebpkc6kq",
    "title": "Water leakage in bathroom",
    "description": "...",
    "images": [
      "entry-photos/b3e01da9-9eb3-4c8a-94d8-30462918241f/1769428982121-889a59f0.png"
    ],
    "imageUrls": [
      {
        "s3Key": "entry-photos/b3e01da9-9eb3-4c8a-94d8-30462918241f/1769428982121-889a59f0.png",
        "viewUrl": "https://society-gate-documents.s3.ap-south-1.amazonaws.com/entry-photos/b3e01da9-9eb3-4c8a-94d8-30462918241f/1769428982121-889a59f0.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260125%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20260125T140000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=..."
      }
    ],
    "reportedBy": {...},
    "flat": {...}
  }
}
```
✅ Mobile app can now view images using presigned URLs

---

### GET `/api/v1/resident/complaints` (List View)

**Before:**
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "id": "cm6sqxvh10001hn21ebpkc6kq",
        "title": "Water leakage",
        "images": ["entry-photos/..."]
      }
    ],
    "pagination": {...}
  }
}
```

**After:**
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "id": "cm6sqxvh10001hn21ebpkc6kq",
        "title": "Water leakage",
        "images": ["entry-photos/..."],
        "imageCount": 1,
        "hasImages": true
      }
    ],
    "pagination": {...}
  }
}
```

**Benefits:**
- `imageCount`: Show badge with number of images in UI
- `hasImages`: Quick boolean check for conditional rendering
- No presigned URLs in list (better performance, URLs only generated when needed)

---

## How Presigned URLs Work

### 1. URL Structure
```
https://bucket-name.s3.region.amazonaws.com/object-key?
  X-Amz-Algorithm=AWS4-HMAC-SHA256&
  X-Amz-Credential=ACCESS_KEY/date/region/s3/aws4_request&
  X-Amz-Date=20260125T140000Z&
  X-Amz-Expires=3600&
  X-Amz-SignedHeaders=host&
  X-Amz-Signature=cryptographic_signature
```

### 2. Security Features
- **Time-Limited:** URL expires after 1 hour (3600 seconds)
- **Cryptographically Signed:** Cannot be tampered with
- **Specific to Object:** Only grants access to one specific file
- **Read-Only:** Only allows downloading/viewing, not modification
- **No Credentials Exposed:** AWS credentials never sent to client

### 3. URL Expiry
```typescript
const viewUrl = await getPresignedViewUrl(s3Key, 3600); // 1 hour
```
- URLs expire after 3600 seconds (1 hour)
- After expiry, mobile app must fetch complaint again to get fresh URLs
- Prevents permanent public access to private images

---

## Performance Considerations

### List View (No Presigned URLs)
**Why:** Generating presigned URLs for 20 complaints × 3 images each = 60 AWS API calls
- Slow response time
- Increased AWS costs
- Unnecessary if user doesn't view images

**Solution:** Only add `imageCount` and `hasImages` flags
- Fast response
- No AWS API calls
- Show image indicators without generating URLs

### Detail View (With Presigned URLs)
**Why:** User is viewing specific complaint, likely wants to see images
- Generate presigned URLs only when needed
- Usually 1-5 images per complaint
- Acceptable latency for detail view

---

## Mobile App Integration Guide

### Display Images in Detail View

```typescript
// React Native example
const ComplaintDetail = ({ complaint }) => {
  return (
    <View>
      <Text>{complaint.title}</Text>
      <Text>{complaint.description}</Text>

      {/* Display images using presigned URLs */}
      {complaint.imageUrls?.map((imageData, index) => (
        <Image
          key={index}
          source={{ uri: imageData.viewUrl }}
          style={{ width: 300, height: 200 }}
        />
      ))}
    </View>
  );
};
```

### Show Image Indicators in List View

```typescript
// React Native example
const ComplaintListItem = ({ complaint }) => {
  return (
    <View>
      <Text>{complaint.title}</Text>

      {/* Show image badge */}
      {complaint.hasImages && (
        <Badge>{complaint.imageCount} photos</Badge>
      )}
    </View>
  );
};
```

### Handle URL Expiry

```typescript
// Refresh complaint data if images fail to load
const handleImageError = async () => {
  console.log('Image failed to load, URL may have expired');
  // Refetch complaint to get fresh presigned URLs
  await refetchComplaint();
};

<Image
  source={{ uri: imageData.viewUrl }}
  onError={handleImageError}
/>
```

---

## Testing Guide

### 1. Create Complaint with Images

```bash
POST /api/v1/resident/complaints
Content-Type: application/json

{
  "category": "MAINTENANCE",
  "title": "Test Complaint",
  "description": "Testing image upload",
  "images": [
    "entry-photos/user-id/1769428982121-test.png"
  ]
}
```

### 2. Fetch Complaints List

```bash
GET /api/v1/resident/complaints
```

**Verify:**
- ✅ Response includes `imageCount: 1`
- ✅ Response includes `hasImages: true`
- ✅ No `imageUrls` field (performance optimization)

### 3. Fetch Complaint by ID

```bash
GET /api/v1/resident/complaints/:id
```

**Verify:**
- ✅ Response includes `images` array (S3 keys)
- ✅ Response includes `imageUrls` array
- ✅ Each `imageUrls` entry has `s3Key` and `viewUrl`
- ✅ `viewUrl` is a valid presigned URL

### 4. Test Presigned URL

```bash
# Copy viewUrl from response and open in browser
curl -I "https://bucket.s3.region.amazonaws.com/...?X-Amz-Signature=..."
```

**Expected:**
- ✅ HTTP 200 OK
- ✅ Image displays in browser
- ✅ Content-Type: image/png or image/jpeg

### 5. Test URL Expiry (After 1 Hour)

```bash
# Wait 1 hour and try the same URL
curl -I "https://bucket.s3.region.amazonaws.com/...?X-Amz-Signature=..."
```

**Expected:**
- ✅ HTTP 403 Forbidden
- ✅ Error: Request has expired

### 6. Test with Multiple Images

```bash
POST /api/v1/resident/complaints
Content-Type: application/json

{
  "category": "MAINTENANCE",
  "title": "Multiple Images",
  "description": "Testing multiple images",
  "images": [
    "entry-photos/user-id/image1.png",
    "entry-photos/user-id/image2.png",
    "entry-photos/user-id/image3.png"
  ]
}
```

**Verify:**
- ✅ List view shows `imageCount: 3`
- ✅ Detail view has 3 entries in `imageUrls` array
- ✅ All 3 presigned URLs work

---

## Error Handling

### 1. Invalid S3 Key

```typescript
// If S3 key doesn't exist in bucket
{
  s3Key: "invalid/path/image.png",
  viewUrl: null  // Will be filtered out
}
```

**Behavior:** Failed URL generation is logged and filtered out, other images still work

### 2. Legacy Local File Paths

```typescript
// If database contains old local file paths
images: ["file:///storage/image.png", "content://media/image.jpg"]
```

**Behavior:**
- Warning logged: `Skipping local file path: file:///storage/image.png`
- URL generation skipped for legacy paths
- Modern S3 paths work normally

### 3. AWS Credentials Missing

**Error:**
```
Error: AWS credentials not configured
```

**Solution:** Ensure `.env` has:
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
S3_BUCKET_NAME=society-gate-documents
```

### 4. S3 Permissions

**Error:**
```
AccessDenied: User not authorized to perform GetObject
```

**Solution:** Ensure IAM user has `s3:GetObject` permission on bucket

---

## Database Schema (Reference)

```prisma
model Complaint {
  id          String   @id @default(cuid())
  title       String
  description String
  images      String[] @default([])  // Array of S3 keys
  // ... other fields
}
```

**Note:**
- `images` field stores S3 keys (not URLs)
- Presigned URLs generated at runtime (not stored)
- This prevents stored URLs from expiring

---

## S3 Utility Reference

Location: [src/utils/s3.ts](src/utils/s3.ts)

```typescript
export async function getPresignedViewUrl(
  s3Key: string,
  expiresIn: number = VIEW_EXPIRY
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
```

**Configuration:**
- Default expiry: 3600 seconds (1 hour)
- Configured via `S3_VIEW_EXPIRY` env var
- Uses AWS SDK v3 with `@aws-sdk/s3-request-presigner`

---

## Advantages of This Approach

### 1. Security
✅ S3 bucket remains private
✅ Time-limited access (URLs expire)
✅ No permanent public URLs
✅ AWS credentials never exposed

### 2. Performance
✅ List view doesn't generate URLs (fast)
✅ Detail view generates URLs only when needed
✅ Parallel URL generation (Promise.all)
✅ Failed generations don't block others

### 3. Scalability
✅ No database storage of URLs
✅ URLs generated on-demand
✅ No cleanup needed for expired URLs
✅ Works with any number of images

### 4. Flexibility
✅ Easy to change expiry time
✅ Handles legacy local file paths
✅ Graceful error handling
✅ Can add more metadata to response

---

## Future Enhancements

### 1. Thumbnail URLs
Generate separate presigned URLs for thumbnails:
```typescript
{
  s3Key: "entry-photos/...",
  viewUrl: "https://...",  // Full size
  thumbnailUrl: "https://..." // Thumbnail (if exists)
}
```

### 2. Longer Expiry for Cached Images
Allow mobile apps to cache images longer:
```typescript
const viewUrl = await getPresignedViewUrl(s3Key, 7200); // 2 hours
```

### 3. Presigned URLs in Other Modules
Apply same pattern to:
- Entry photos
- Gate pass images
- Vendor documents
- Staff verification photos

### 4. URL Refresh Endpoint
Dedicated endpoint to refresh expired URLs:
```typescript
POST /api/v1/complaints/:id/refresh-image-urls
```

---

## Troubleshooting

### Issue: Images not displaying in mobile app

**Check:**
1. Presigned URLs present in API response?
2. URLs formatted correctly (start with https://)?
3. URLs not expired (check timestamp)?
4. Mobile app has internet connection?
5. S3 bucket allows GetObject from presigned URLs?

**Solution:**
```bash
# Test URL in browser
curl -I "https://bucket.s3.region.amazonaws.com/...?X-Amz-Signature=..."
```

### Issue: HTTP 403 Forbidden when accessing URL

**Possible Causes:**
1. URL expired (1 hour limit)
2. AWS credentials invalid
3. IAM permissions missing
4. S3 key doesn't exist

**Solution:**
- Fetch complaint again to get fresh URLs
- Check AWS credentials in `.env`
- Verify IAM user has `s3:GetObject` permission

### Issue: Slow response times

**Check:**
1. How many images per complaint?
2. Generating URLs in list view (shouldn't be)?
3. Network latency to AWS S3?

**Solution:**
- Ensure list view doesn't generate presigned URLs
- Only detail view should generate URLs
- Consider CDN for faster access

---

## Summary

### Changes Made
✅ Added `getPresignedViewUrl` import
✅ Created `generateImageUrls` helper method
✅ Updated `getComplaintById` to include `imageUrls`
✅ Updated `getComplaints` to include `imageCount` and `hasImages`
✅ TypeScript compilation successful
✅ No breaking changes to existing functionality

### API Changes
✅ Detail view: Added `imageUrls` array with presigned URLs
✅ List view: Added `imageCount` and `hasImages` fields
✅ Original `images` field unchanged (backward compatible)

### Benefits
✅ Mobile apps can now view private S3 images
✅ Secure time-limited access
✅ Optimized performance (URLs only when needed)
✅ Graceful error handling
✅ Ready for production use

---

**Last Updated:** 2026-01-25
**Version:** 1.0
