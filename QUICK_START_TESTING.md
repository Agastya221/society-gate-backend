# Quick Start - API Testing Guide

## 🚀 Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:4000`

---

## 📖 Access API Documentation

### Swagger UI (Interactive)
Open in your browser:
```
http://localhost:4000/api-docs
```

Features:
- ✅ Try all endpoints interactively
- ✅ See request/response examples
- ✅ Test authentication
- ✅ View all schemas

---

## 🔑 Authentication Flow

### 1. Admin Login (Email/Password)

**Endpoint:** `POST /api/auth/login-admin`

```bash
curl -X POST http://localhost:3000/api/auth/login-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@society.com",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "name": "Admin Name",
      "email": "admin@society.com",
      "role": "ADMIN"
    }
  }
}
```

### 2. Resident Login (OTP)

**Step 1:** Send OTP
```bash
curl -X POST http://localhost:3000/api/auth/send-otp-resident \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

**Step 2:** Verify OTP
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp-resident \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456"
  }'
```

### 3. Guard Login (OTP)

```bash
curl -X POST http://localhost:3000/api/auth/send-otp-guard \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'

curl -X POST http://localhost:3000/api/auth/verify-otp-guard \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456"
  }'
```

### 4. Use Token in Requests

Add the token to the `Authorization` header:
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🏠 Common API Workflows

### Create Entry (Guard)

```bash
TOKEN="your-guard-token"

curl -X POST http://localhost:3000/api/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entryType": "VISITOR",
    "visitorName": "John Doe",
    "visitorPhone": "+919876543210",
    "vehicleNumber": "MH01AB1234",
    "purpose": "Personal visit",
    "flatId": "flat-uuid",
    "societyId": "society-uuid"
  }'
```

### Check-In Domestic Staff

```bash
TOKEN="your-guard-token"

curl -X POST http://localhost:3000/api/domestic-staff/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domesticStaffId": "staff-uuid",
    "flatId": "flat-uuid",
    "societyId": "society-uuid",
    "notes": "Regular cleaning"
  }'
```

### Create Notice (Admin)

```bash
TOKEN="your-admin-token"

curl -X POST http://localhost:3000/api/notices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Water Supply Maintenance",
    "description": "Water will be suspended on Sunday 10 AM to 2 PM",
    "category": "MAINTENANCE",
    "priority": "HIGH",
    "societyId": "society-uuid",
    "publishDate": "2026-01-12T00:00:00Z",
    "expiryDate": "2026-01-13T23:59:59Z"
  }'
```

### Book Amenity (Resident)

```bash
TOKEN="your-resident-token"

curl -X POST http://localhost:3000/api/amenities/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amenityId": "amenity-uuid",
    "flatId": "flat-uuid",
    "societyId": "society-uuid",
    "bookingDate": "2026-01-15",
    "startTime": "10:00",
    "endTime": "14:00",
    "purpose": "Birthday party",
    "guestCount": 25
  }'
```

### Create Emergency Alert (Resident)

```bash
TOKEN="your-resident-token"

curl -X POST http://localhost:3000/api/emergencies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alertType": "SOS",
    "description": "Medical emergency",
    "location": "Flat 501, Building A",
    "flatId": "flat-uuid",
    "societyId": "society-uuid"
  }'
```

---

## 📊 Testing Endpoints

### Domestic Staff Module

#### List All Staff
```bash
curl -X GET "http://localhost:3000/api/domestic-staff?staffType=MAID&isActive=true" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Available Staff
```bash
curl -X GET "http://localhost:3000/api/domestic-staff/available?staffType=NANNY&date=2026-01-15&startTime=10:00&endTime=14:00" \
  -H "Authorization: Bearer $TOKEN"
```

#### Create Staff Booking
```bash
curl -X POST http://localhost:3000/api/domestic-staff/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domesticStaffId": "staff-uuid",
    "flatId": "flat-uuid",
    "societyId": "society-uuid",
    "bookingDate": "2026-01-15",
    "startTime": "10:00",
    "endTime": "14:00",
    "durationHours": 4,
    "workType": "House cleaning",
    "requirements": "Deep cleaning required",
    "estimatedCost": 600
  }'
```

#### Scan QR Code (Check-in/Check-out)
```bash
curl -X POST http://localhost:3000/api/domestic-staff/scan \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qrToken": "staff-qr-token",
    "flatId": "flat-uuid",
    "societyId": "society-uuid"
  }'
```

---

## 🧪 Testing Race Conditions (Fixed)

### Test Concurrent Check-ins

Open two terminals and run simultaneously:

**Terminal 1:**
```bash
curl -X POST http://localhost:3000/api/domestic-staff/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domesticStaffId":"staff-uuid","flatId":"flat-uuid","societyId":"society-uuid"}'
```

**Terminal 2 (same request):**
```bash
curl -X POST http://localhost:3000/api/domestic-staff/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domesticStaffId":"staff-uuid","flatId":"flat-uuid","societyId":"society-uuid"}'
```

**Expected Result:**
- ✅ One request succeeds
- ✅ Second request fails with: `"Staff is already checked in"`

### Test Concurrent Amenity Bookings

Same concept - run two bookings for the same time slot simultaneously.

**Expected Result:**
- ✅ One succeeds
- ✅ Second fails with: `"This time slot is already booked"`

---

## 🔍 Query Parameters Guide

### Pagination
```bash
# Most list endpoints support pagination
?page=1&limit=20
```

### Filtering
```bash
# Filter by status
?status=ACTIVE

# Filter by type
?entryType=VISITOR

# Filter by date range
?from=2026-01-01&to=2026-01-31
```

### Search
```bash
# Search staff by name or phone
?search=ramesh
```

---

## 🎯 Common HTTP Status Codes

| Code | Meaning | When You'll See It |
|------|---------|-------------------|
| 200 | Success | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Something went wrong on server |

---

## 🐛 Debugging Tips

### Check Server Logs
```bash
# Server logs show all requests and errors
npm run dev
```

### Test with Verbose Output
```bash
# Add -v flag to curl for detailed output
curl -v http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Validate JSON
```bash
# Use echo to validate your JSON before sending
echo '{
  "name": "test",
  "phone": "+919876543210"
}' | jq .
```

### Pretty Print Responses
```bash
# Pipe responses through jq for readable output
curl http://localhost:3000/api/domestic-staff \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 🔧 Environment Setup

### Required Environment Variables

Create `.env` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/society_gate"

# JWT
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# SMS (for OTP)
SMS_API_KEY="your-sms-api-key"
SMS_SENDER_ID="SOCIETY"
```

---

## 📱 Postman Collection

Import the Swagger file into Postman:

1. Open Postman
2. Click Import
3. Choose "OpenAPI 3.0"
4. Upload `swagger.yaml`
5. Collection auto-generated with all endpoints!

---

## ✅ Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-11T10:30:00.000Z"
}
```

---

## 🎓 Next Steps

1. ✅ Test all authentication flows
2. ✅ Create sample data (society, flats, users)
3. ✅ Test domestic staff workflow end-to-end
4. ✅ Test amenity booking workflow
5. ✅ Test complaint management
6. ✅ Test emergency alerts
7. ✅ Verify all race condition fixes
8. ✅ Load test critical endpoints

---

## 🆘 Common Issues

### "User must have a flat assigned"
**Solution:** Assign a flat to the resident user before accessing resident-only endpoints.

### "Access denied. You can only access resources in your society"
**Solution:** Ensure the `societyId` in your request matches your user's `societyId`.

### "Invalid token" or "Token expired"
**Solution:** Get a new token by logging in again.

### "Staff is not available at this time"
**Solution:** Check existing bookings for the staff member at that time.

---

Happy Testing! 🚀

For full API documentation, visit: **http://localhost:3000/api-docs**
