# Comprehensive Domestic Staff Management System

## 🎉 Overview

The old limited "Maid" module has been completely replaced with a **comprehensive Domestic Staff Management System** that supports:
- **All types of workers**: Maids, Nannies, Cooks, Drivers, Cleaners, Laundry staff, Gardeners, Caretakers, etc.
- **Real-time attendance tracking** with QR code check-in/check-out
- **On-demand bookings** for urgent/temporary hiring
- **Multi-flat assignments** (staff can work for multiple flats)
- **Reviews and ratings** system
- **Availability status** tracking
- **Push notifications** ready (when integrated)

---

## 📊 Database Schema

### New Models Added

1. **DomesticStaff** - Main staff profile
2. **StaffFlatAssignment** - Multi-flat work assignments
3. **StaffAttendance** - Real-time check-in/check-out tracking
4. **StaffBooking** - On-demand/urgent bookings
5. **StaffReview** - Reviews and ratings

### New Enums

- **DomesticStaffType**: MAID, COOK, NANNY, DRIVER, CLEANER, GARDENER, LAUNDRY, CARETAKER, SECURITY_GUARD, OTHER
- **StaffAvailabilityStatus**: AVAILABLE, BUSY, ON_LEAVE, INACTIVE
- **StaffBookingStatus**: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED

---

## 🚀 Features

### 1. Staff Profile Management

**Complete Profile with:**
- Basic info (name, phone, email, photo)
- Staff type (maid, nanny, cook, driver, etc.)
- Experience years
- Bio/description of skills and specialties
- Languages spoken
- ID proof (type, number, document URL)
- Address and emergency contact
- Verification status (verified by admin)
- Rating and review count

**API Endpoints:**
- `POST /api/domestic-staff` - Add new staff (Resident/Admin)
- `GET /api/domestic-staff` - List all staff with filters
- `GET /api/domestic-staff/:id` - Get staff profile
- `PATCH /api/domestic-staff/:id` - Update staff profile
- `DELETE /api/domestic-staff/:id` - Delete staff
- `PATCH /api/domestic-staff/:id/verify` - Verify staff (Admin only)
- `GET /api/domestic-staff/:id/qr` - Get QR code for attendance

**Filters:**
- `staffType` - Filter by type (MAID, COOK, NANNY, etc.)
- `availabilityStatus` - AVAILABLE, BUSY, ON_LEAVE
- `isVerified` - true/false
- `isActive` - true/false
- `search` - Search by name or phone

---

### 2. Multi-Flat Assignment System

Staff can work for multiple flats with different schedules and rates.

**Features:**
- Assign staff to multiple flats
- Different working days for each flat
- Different working hours for each flat
- Different payment rates for each flat
- Mark primary employer

**API Endpoints:**
- `POST /api/domestic-staff/assignments` - Assign staff to flat
- `GET /api/domestic-staff/:staffId/assignments` - Get all assignments
- `PATCH /api/domestic-staff/assignments/:id` - Update assignment
- `DELETE /api/domestic-staff/assignments/:id` - Remove assignment

**Example Request:**
```json
{
  "domesticStaffId": "staff-uuid",
  "flatId": "flat-uuid",
  "isPrimary": true,
  "workingDays": ["MON", "WED", "FRI"],
  "workStartTime": "09:00",
  "workEndTime": "11:00",
  "agreedRate": 5000,
  "rateType": "monthly"
}
```

---

### 3. Real-Time Attendance Tracking

**QR Code Based Check-In/Check-Out:**
- Each staff member gets a unique QR code
- Guard or resident scans QR to check-in/check-out
- Automatic duration calculation
- Track which flat they're working at
- Notes and work completed tracking
- Guard verification

**Current Status Tracking:**
- `isCurrentlyWorking` - Is staff currently at work?
- `currentFlatId` - Which flat are they at?
- `lastCheckIn` / `lastCheckOut` - Timestamps
- `availabilityStatus` - AVAILABLE, BUSY, ON_LEAVE

**API Endpoints:**
- `POST /api/domestic-staff/check-in` - Manual check-in
- `POST /api/domestic-staff/:staffId/check-out` - Manual check-out
- `POST /api/domestic-staff/scan` - QR code scan (auto check-in/out)
- `GET /api/domestic-staff/attendance/records` - Get attendance history

**QR Scan Flow:**
```
1. Guard/Resident scans staff QR code
2. System checks if staff is currently working:
   - If NO → Check IN at the scanned flat
   - If YES → Check OUT from current location
3. Updates staff status and availability
4. Calculates work duration
5. Sends push notification to resident (when implemented)
```

**Check-In Request:**
```json
{
  "domesticStaffId": "staff-uuid",
  "flatId": "flat-uuid",
  "societyId": "society-uuid",
  "checkInMethod": "QR",
  "notes": "Regular cleaning work"
}
```

**Check-Out Request:**
```json
{
  "workCompleted": "Cleaned 3 rooms, kitchen, and balcony"
}
```

---

### 4. On-Demand Bookings (Urgent Hiring)

**Book staff for temporary/urgent work:**
- Residents can book available staff
- Specify date, time, and duration
- Describe work requirements
- Estimated cost calculation
- Staff can accept/reject bookings
- Payment tracking

**API Endpoints:**
- `POST /api/domestic-staff/bookings` - Create booking
- `GET /api/domestic-staff/bookings/list` - List bookings
- `PATCH /api/domestic-staff/bookings/:id/accept` - Accept booking
- `PATCH /api/domestic-staff/bookings/:id/reject` - Reject booking
- `PATCH /api/domestic-staff/bookings/:id/complete` - Mark as completed

**Example Booking:**
```json
{
  "domesticStaffId": "staff-uuid",
  "flatId": "flat-uuid",
  "societyId": "society-uuid",
  "bookingDate": "2026-01-15",
  "startTime": "10:00",
  "endTime": "14:00",
  "durationHours": 4,
  "workType": "Deep cleaning",
  "requirements": "Bring cleaning supplies, focus on bathrooms and kitchen",
  "estimatedCost": 800
}
```

**Booking Status Flow:**
```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
         ↓
      CANCELLED
```

**Conflict Detection:**
- System automatically checks for time conflicts
- Shows only available staff for the requested time slot

---

### 5. Reviews & Ratings System

**Residents can review staff after work:**
- Overall rating (1-5 stars)
- Written review
- Detailed ratings:
  - Work quality (1-5)
  - Punctuality (1-5)
  - Behavior (1-5)
- Context: work type and date

**Automatic Rating Updates:**
- Staff's overall rating is automatically calculated
- Total review count is tracked
- Displayed on staff profile

**API Endpoints:**
- `POST /api/domestic-staff/reviews` - Add review
- `GET /api/domestic-staff/:staffId/reviews` - Get all reviews

**Example Review:**
```json
{
  "domesticStaffId": "staff-uuid",
  "flatId": "flat-uuid",
  "rating": 5,
  "review": "Excellent work! Very professional and thorough.",
  "workQuality": 5,
  "punctuality": 5,
  "behavior": 5,
  "workType": "House cleaning",
  "workDate": "2026-01-10"
}
```

---

### 6. Availability Management

**Real-time availability status:**
- AVAILABLE - Ready to take bookings
- BUSY - Currently working
- ON_LEAVE - Not available
- INACTIVE - Permanently unavailable

**Smart Availability:**
- Automatically set to BUSY when checked in
- Automatically set to AVAILABLE when checked out
- Can be manually updated by staff/admin

**Find Available Staff:**
- `GET /api/domestic-staff/available?staffType=NANNY&bookingDate=2026-01-15&startTime=10:00&endTime=14:00`
- Returns only staff with no conflicting bookings
- Sorted by verification status and rating

**API Endpoints:**
- `GET /api/domestic-staff/available` - Get available staff
- `PATCH /api/domestic-staff/:id/availability` - Update availability status

---

### 7. Pricing & Payment

**Flexible pricing models:**
- `hourlyRate` - Per hour rate
- `dailyRate` - Full day rate
- `monthlyRate` - Monthly salary
- Per-flat custom rates in assignments

**Booking Payment Tracking:**
- `estimatedCost` - Estimated before booking
- `finalCost` - Actual cost after completion
- `isPaid` - Payment status
- `paidAt` - Payment timestamp

---

## 🔔 Push Notifications (Ready for Integration)

**Notification triggers implemented (needs push service integration):**

### For Residents:
1. **Staff Check-In**: "Your maid has checked in at 9:00 AM"
2. **Staff Check-Out**: "Your maid checked out at 11:00 AM. Duration: 2 hours"
3. **Booking Accepted**: "Your booking for nanny on Jan 15 has been accepted"
4. **Booking Rejected**: "Your booking was rejected: Already booked for that time"

### For Staff:
1. **New Booking Request**: "You have a new booking request for Jan 15, 10 AM - 2 PM"
2. **Booking Cancelled**: "Booking for Jan 15 has been cancelled by resident"

### For Admins:
1. **New Staff Added**: "New staff member added: John Doe (Cook)"
2. **Review Submitted**: "New review for Maria (Maid): 5 stars"

**TODO:** Integrate with Firebase Cloud Messaging or similar service

---

## 📱 Mobile App Features (Frontend)

### Resident App Screens:

1. **Staff Directory**
   - Browse all staff by type (Maids, Nannies, Cooks, etc.)
   - Filter by availability, rating, verification
   - View staff profiles with photos, ratings, reviews
   - See current status (available, busy, on leave)

2. **My Staff**
   - List of staff assigned to your flat
   - View schedules and working days
   - Quick actions: Call, View QR, Check Attendance
   - Payment history

3. **Book Staff**
   - Select staff type
   - Choose date and time
   - See available staff
   - Book instantly or request booking
   - Track booking status

4. **Attendance History**
   - See when staff checked in/out
   - View work completed notes
   - Export attendance reports
   - Filter by date range and staff

5. **Staff Profile View**
   - Full profile with photo and details
   - All reviews and ratings
   - Availability calendar
   - Assigned flats (if shared)
   - Book button

### Guard App Screens:

1. **QR Scanner**
   - Scan staff QR codes
   - Shows staff details and check-in/out status
   - Manual override options
   - Verification notes

2. **Today's Attendance**
   - List of all staff currently working
   - Which flat they're at
   - Check-in times
   - Quick checkout

### Admin App Features:

1. **Staff Management**
   - Add new staff
   - Verify staff members
   - View all assignments
   - Generate reports

2. **Analytics Dashboard**
   - Total staff count by type
   - Active staff today
   - Most booked staff
   - Average ratings
   - Attendance patterns

---

## 🔍 Example Use Cases

### Use Case 1: Regular Maid Service
```
1. Resident adds maid to their flat
2. Maid is assigned to work Mon/Wed/Fri, 9 AM - 11 AM
3. Payment: ₹5000/month
4. Each day, maid scans QR to check-in
5. After work, scans again to check-out
6. System tracks all attendance automatically
7. Resident gets notifications on check-in/out
8. At month end, resident reviews and pays
```

### Use Case 2: Urgent Nanny Booking
```
1. Resident needs nanny for 4 hours urgently
2. Opens app, searches for available nannies
3. Sees 3 nannies available on selected date/time
4. Reviews profiles, ratings, and pricing
5. Books the highest-rated nanny for ₹800
6. Nanny receives notification and accepts
7. On the day, nanny scans QR to check-in
8. After 4 hours, scans to check-out
9. Resident marks booking as complete and pays
10. Resident leaves a 5-star review
```

### Use Case 3: Shared Cook
```
1. Cook works for 5 different flats
2. Each flat has different timings:
   - Flat A: Mon/Wed/Fri, 7-8 AM (breakfast)
   - Flat B: Mon/Wed/Fri, 8:30-9:30 AM (breakfast)
   - Flat C: Tue/Thu/Sat, 7-8 AM (breakfast)
   - Flat D: Daily, 5-6 PM (dinner)
   - Flat E: Daily, 6:30-7:30 PM (dinner)
3. Cook scans QR at each flat
4. System tracks:
   - Which flat they're at
   - Exact duration worked
   - Attendance per flat
5. Each flat pays based on days worked
```

### Use Case 4: Society Directory
```
1. New resident joins society
2. Searches for available staff in society
3. Sees staff profiles with:
   - Type, experience, languages
   - Ratings and reviews from other residents
   - Availability and pricing
   - Verification status
4. Contacts staff directly or books through app
5. Staff accepts and gets assigned to the flat
```

---

## 🛠️ Implementation Status

### ✅ Completed
- [x] Complete database schema with 5 new tables
- [x] Comprehensive service layer with all features
- [x] Full controller implementation
- [x] RESTful API routes
- [x] QR code generation for each staff
- [x] Attendance tracking system
- [x] Booking system with conflict detection
- [x] Reviews and ratings system
- [x] Multi-flat assignment support
- [x] Availability management

### 🚧 TODO for Production
1. **Push Notifications**
   - Integrate Firebase Cloud Messaging
   - Send notifications on check-in/out
   - Send notifications on bookings
   - Send notifications on reviews

2. **Photo Upload**
   - Integrate cloud storage (AWS S3/Cloudinary)
   - Staff photo upload endpoint
   - ID proof document upload
   - Work photo attachments

3. **Payment Integration**
   - Integrate payment gateway (Razorpay/Stripe)
   - Track payments for bookings
   - Monthly salary tracking
   - Generate payment receipts

4. **Analytics Dashboard**
   - Most active staff
   - Booking trends
   - Attendance patterns
   - Revenue by staff type

5. **Advanced Features**
   - Background verification integration
   - GPS-based check-in verification
   - Video interview links
   - Staff app (separate app for staff members)

---

## 📝 API Endpoints Summary

### Staff Management
```
POST   /api/domestic-staff                    Add staff
GET    /api/domestic-staff                    List staff (with filters)
GET    /api/domestic-staff/available          Get available staff
GET    /api/domestic-staff/:id                Get staff profile
GET    /api/domestic-staff/:id/qr             Get QR code
PATCH  /api/domestic-staff/:id                Update staff
PATCH  /api/domestic-staff/:id/verify         Verify staff (Admin)
PATCH  /api/domestic-staff/:id/availability   Update availability
DELETE /api/domestic-staff/:id                Delete staff
```

### Assignments
```
POST   /api/domestic-staff/assignments        Assign to flat
GET    /api/domestic-staff/:staffId/assignments  Get assignments
PATCH  /api/domestic-staff/assignments/:id    Update assignment
DELETE /api/domestic-staff/assignments/:id    Remove assignment
```

### Attendance
```
POST   /api/domestic-staff/check-in           Check in
POST   /api/domestic-staff/:staffId/check-out Check out
POST   /api/domestic-staff/scan               QR scan (auto check-in/out)
GET    /api/domestic-staff/attendance/records Attendance history
```

### Bookings
```
POST   /api/domestic-staff/bookings           Create booking
GET    /api/domestic-staff/bookings/list      List bookings
PATCH  /api/domestic-staff/bookings/:id/accept    Accept
PATCH  /api/domestic-staff/bookings/:id/reject    Reject
PATCH  /api/domestic-staff/bookings/:id/complete  Complete
```

### Reviews
```
POST   /api/domestic-staff/reviews            Add review
GET    /api/domestic-staff/:staffId/reviews   Get reviews
```

---

## 🎯 Key Improvements Over Old "Maid" System

| Feature | Old Maid System | New Domestic Staff System |
|---------|----------------|---------------------------|
| **Staff Types** | Only "Maid" | 10 types: Maid, Nanny, Cook, Driver, Cleaner, Laundry, etc. |
| **Work Assignments** | Single flat only | Multi-flat with different schedules |
| **Attendance** | Simple check-in/out | Real-time tracking with QR, duration, notes |
| **Booking** | Not supported | Full on-demand booking system |
| **Reviews** | Not supported | Complete rating and review system |
| **Availability** | Basic flags | Real-time status with conflict detection |
| **Pricing** | Single rate | Flexible: hourly, daily, monthly, per-flat |
| **Profiles** | Basic info | Complete profiles with skills, experience, languages |
| **Verification** | Not supported | Admin verification with document upload |
| **Notifications** | Not supported | Ready for push notifications |
| **Discovery** | Limited | Society-wide directory with search and filters |

---

## 🚀 Next Steps

1. **Integrate Push Notifications** - Most critical for user experience
2. **Add Photo Upload** - Cloud storage for profile photos and documents
3. **Payment Integration** - Track and process payments
4. **Build Mobile UI** - Beautiful, intuitive mobile app screens
5. **Staff App** - Separate app for staff to manage their bookings and availability

---

Your Society Gate app now has a **world-class domestic staff management system** that rivals any major housing society app! 🎉
