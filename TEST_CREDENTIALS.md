# Society Gate Backend - Test Credentials & Quick Start

## 🚀 Server Status

✅ **Server Running**: http://localhost:4000
✅ **API Documentation**: http://localhost:4000/api-docs
✅ **Health Check**: http://localhost:4000/health

---

## 📱 Test Accounts

### Super Admin Account
- **Email**: admin@societygate.com
- **Phone**: +919999999999
- **Password**: admin123
- **Access**: Full system access

### Society Admin Account
- **Name**: Rajesh Kumar
- **Email**: rajesh@greenvalley.com
- **Phone**: +919876543210
- **Password**: admin123
- **Society**: Green Valley Apartments, Patna
- **Access**: Admin features for Green Valley Apartments

### Guard Account
- **Phone**: +919111222333
- **Password**: guard123
- **Society**: Green Valley Apartments
- **Access**: Entry/exit management, visitor check-in

### Resident Accounts

#### Resident 1 - Amit Kumar
- **Phone**: +919123456789
- **Password**: resident123
- **Flat**: A-101
- **Society**: Green Valley Apartments

#### Resident 2 - Priya Singh
- **Phone**: +919988776655
- **Password**: resident123
- **Flat**: A-102
- **Society**: Green Valley Apartments

#### Resident 3 - Rahul Sharma
- **Phone**: +919876501111
- **Password**: resident123
- **Flat**: B-201
- **Society**: Green Valley Apartments

---

## 🏢 Test Data Summary

### Society Information
- **Name**: Green Valley Apartments
- **Location**: Boring Road, Patna, Bihar - 800001
- **Total Flats**: 50 (3 populated with residents)
- **Contact**: Rajesh Kumar
- **Monthly Fee**: ₹500

### Flats
1. **A-101** - Amit Kumar
2. **A-102** - Priya Singh
3. **B-201** - Rahul Sharma

### Domestic Staff (3)
1. **Sunita Devi** (MAID) - Phone: +919876111111
2. **Raju Kumar** (COOK) - Phone: +919876222222
3. **Geeta Sharma** (NANNY) - Phone: +919876333333

### Amenities (3)
1. **Swimming Pool** - ₹500/hour, Capacity: 50
2. **Clubhouse** - ₹2000/hour, Capacity: 100
3. **Fitness Center** - Free, Capacity: 20

### Notices (3)
1. Water Supply Maintenance (HIGH priority)
2. Society Annual Meeting (MEDIUM priority)
3. Holi Celebration (LOW priority)

### Vendors (2)
1. **Ramesh Plumbing Services** - Plumber
2. **Kumar Electricals** - Electrician

---

## 🔐 Quick Login Examples

### Admin Login (Email/Password)
```bash
curl -X POST http://localhost:4000/api/auth/login-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rajesh@greenvalley.com",
    "password": "admin123"
  }'
```

### Guard Login (Phone/OTP)

**Step 1: Send OTP**
```bash
curl -X POST http://localhost:4000/api/auth/send-otp-guard \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919111222333"}'
```

**Step 2: Verify OTP**
```bash
curl -X POST http://localhost:4000/api/auth/verify-otp-guard \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919111222333",
    "otp": "YOUR_OTP_HERE"
  }'
```

### Resident Login (Phone/OTP)

**Step 1: Send OTP**
```bash
curl -X POST http://localhost:4000/api/auth/send-otp-resident \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919123456789"}'
```

**Step 2: Verify OTP**
```bash
curl -X POST http://localhost:4000/api/auth/verify-otp-resident \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919123456789",
    "otp": "YOUR_OTP_HERE"
  }'
```

---

## 🧪 Testing Common Workflows

### 1. Create Visitor Entry (Guard)

First login as guard, then:
```bash
TOKEN="your-guard-token"

curl -X POST http://localhost:4000/api/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "VISITOR",
    "visitorName": "John Doe",
    "visitorPhone": "+919999888777",
    "vehicleNumber": "BR01AB1234",
    "purpose": "Personal visit",
    "flatId": "FLAT_ID_HERE",
    "societyId": "SOCIETY_ID_HERE"
  }'
```

### 2. Book Amenity (Resident)

Login as resident, then:
```bash
TOKEN="your-resident-token"

curl -X POST http://localhost:4000/api/amenities/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amenityId": "AMENITY_ID_HERE",
    "flatId": "FLAT_ID_HERE",
    "societyId": "SOCIETY_ID_HERE",
    "bookingDate": "2026-01-20",
    "startTime": "10:00",
    "endTime": "14:00",
    "purpose": "Birthday party",
    "guestCount": 25
  }'
```

### 3. Create Notice (Admin)

Login as admin, then:
```bash
TOKEN="your-admin-token"

curl -X POST http://localhost:4000/api/notices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Important Notice",
    "description": "This is a test notice",
    "type": "GENERAL",
    "priority": "HIGH",
    "societyId": "SOCIETY_ID_HERE",
    "publishAt": "2026-01-11T00:00:00Z",
    "expiresAt": "2026-01-18T23:59:59Z"
  }'
```

### 4. Check-In Domestic Staff (Guard)

```bash
TOKEN="your-guard-token"

curl -X POST http://localhost:4000/api/domestic-staff/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domesticStaffId": "STAFF_ID_HERE",
    "flatId": "FLAT_ID_HERE",
    "societyId": "SOCIETY_ID_HERE",
    "notes": "Regular cleaning work"
  }'
```

### 5. List Available Staff (Resident)

```bash
TOKEN="your-resident-token"

curl -X GET "http://localhost:4000/api/domestic-staff/available?staffType=MAID&date=2026-01-15&startTime=10:00&endTime=14:00" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Get IDs for Testing

### Get Society ID
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```
The response will include `societyId`.

### Get Flat IDs
```bash
curl http://localhost:4000/api/flats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Amenity IDs
```bash
curl http://localhost:4000/api/amenities \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Domestic Staff IDs
```bash
curl http://localhost:4000/api/domestic-staff \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎯 Testing Checklist

- [ ] Login as Super Admin
- [ ] Login as Society Admin
- [ ] Login as Guard (OTP flow)
- [ ] Login as Resident (OTP flow)
- [ ] Create visitor entry
- [ ] Check-in domestic staff
- [ ] Check-out domestic staff
- [ ] Book amenity
- [ ] Create notice
- [ ] Create complaint
- [ ] Create emergency alert
- [ ] Create pre-approval
- [ ] Scan gate pass
- [ ] View reports
- [ ] Test race condition fixes (concurrent check-ins)

---

## 🐛 Common Issues

### "User must have a flat assigned"
**Solution**: Login with a resident account that has a flat (use one of the 3 test residents).

### "Access denied. You can only access resources in your society"
**Solution**: Make sure the `societyId` in your request matches your user's `societyId`.

### "Invalid token" or "Token expired"
**Solution**: Get a fresh token by logging in again.

### Getting IDs for requests
**Solution**: First call GET endpoints to list resources and get their IDs, then use those IDs in POST/PUT requests.

---

## 📖 Full Documentation

- **Swagger UI**: http://localhost:4000/api-docs (Interactive testing)
- **Quick Start Guide**: [QUICK_START_TESTING.md](./QUICK_START_TESTING.md)
- **Fixes Applied**: [FIXES_AND_IMPROVEMENTS.md](./FIXES_AND_IMPROVEMENTS.md)

---

## 🆘 Development Commands

```bash
# Start dev server
npm run dev

# Build project
npm run build

# Run seed file
npx ts-node prisma/seed-simple.ts

# Generate Prisma client
npx prisma generate

# View database (Prisma Studio)
npx prisma studio
```

---

**Happy Testing!** 🚀

For any questions or issues, check the Swagger documentation at http://localhost:4000/api-docs
