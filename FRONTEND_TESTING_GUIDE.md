# Frontend Testing Guide - Society Gate

## 🚀 Quick Start

Your frontend testing client is now running at: **http://localhost:5173**

Backend API is running at: **http://localhost:4000**

---

## 📱 Testing Scenarios

### Scenario 1: New Resident Onboarding (Happy Path)

**Steps:**

1. **Open Browser**
   - Navigate to `http://localhost:5173`

2. **Login with OTP**
   - Enter phone: `9123456789`
   - Click "Send OTP"
   - Enter any 6-digit OTP (e.g., `123456`)
   - Enter name: `Test User`
   - Enter email: `test@example.com`
   - Click "Verify & Continue"

3. **Select Society**
   - You'll see "Green Valley Apartments" (from seed data)
   - Click on it to select

4. **Select Block**
   - Choose any block/tower
   - Click "Next"

5. **Select Flat**
   - Choose an available flat
   - Click "Next"

6. **Choose Role**
   - Select "Owner" or "Tenant"
   - Click "Next"

7. **Upload Documents**
   - Upload Ownership Proof (for Owner) or Tenant Agreement (for Tenant)
   - Upload Aadhar Card
   - Click "Next"

8. **Review & Submit**
   - Review all details
   - Click "Submit Onboarding Request"

9. **Check Status**
   - You'll be redirected to status page
   - Status shows "PENDING_APPROVAL"
   - Page auto-refreshes every 10 seconds

---

### Scenario 2: Admin Approval Workflow

**Steps:**

1. **Open New Incognito Window**
   - Go to `http://localhost:5173`

2. **Login as Admin**
   - Phone: `9876543210`
   - Password: `admin123`
   - (Use password login, not OTP)

3. **Access Admin Dashboard**
   - Click "Go to Admin Dashboard" or navigate to `/admin`

4. **Review Pending Request**
   - You'll see the request from Scenario 1
   - Click "Review"

5. **Approve Request**
   - Review resident information
   - Review documents
   - Click "Approve"
   - Optionally add notes
   - Click "Confirm Approval"

6. **Verify in Resident Window**
   - Go back to the first browser window
   - Status should update to "APPROVED" automatically
   - Green success message appears

---

### Scenario 3: Request Resubmission

**Steps:**

1. **Create Another Resident Request** (follow Scenario 1)

2. **Login as Admin** (follow Scenario 2)

3. **Request Resubmission**
   - Click "Review" on the new request
   - Click "Request Resubmit"
   - Enter reason: "Please upload clearer images of Aadhar card"
   - Click "Confirm Resubmission"

4. **Check Resident Status**
   - Status updates to "RESUBMIT_REQUESTED"
   - Shows admin's feedback message

---

### Scenario 4: Rejection

**Steps:**

1. **Create Another Resident Request**

2. **Login as Admin**

3. **Reject Request**
   - Click "Review"
   - Click "Reject"
   - Enter reason: "Invalid ownership documents"
   - Click "Confirm Rejection"

4. **Verify Rejection**
   - Resident status shows "REJECTED"
   - Displays rejection reason

---

## 🧪 Edge Cases to Test

### 1. Duplicate Flat Claims
- Create 2 residents trying to claim same flat as OWNER
- Second request should fail with error

### 2. Multiple Tenants
- Create multiple residents claiming same flat as TENANT
- All should be allowed (multiple tenants per flat)

### 3. Invalid OTP
- Enter wrong OTP during login
- Should show error message

### 4. Missing Documents
- Try to submit without uploading required documents
- "Next" button should be disabled

### 5. Unauthorized Access
- Try accessing `/admin` without admin login
- Should show "Access Denied"

### 6. Auto-refresh
- Submit a request
- Keep status page open
- Approve from admin panel
- Status should update within 10 seconds

---

## 📊 What to Check

### ✅ Resident Flow
- [ ] OTP sent successfully
- [ ] OTP verification works
- [ ] Profile creation with name/email
- [ ] Society list loads
- [ ] Block list loads based on society
- [ ] Flat list loads based on block
- [ ] Role selection works
- [ ] Document upload (mock) works
- [ ] Submit button enabled only when all docs uploaded
- [ ] Request submits successfully
- [ ] Redirects to status page
- [ ] Status shows "PENDING_APPROVAL"

### ✅ Admin Flow
- [ ] Admin login works
- [ ] Dashboard shows pending requests
- [ ] Request count is correct
- [ ] Can view request details
- [ ] Documents are displayed
- [ ] Can approve with optional notes
- [ ] Can reject with mandatory reason
- [ ] Can request resubmission
- [ ] Actions update database
- [ ] Resident status updates automatically

### ✅ Real-time Updates
- [ ] Status page refreshes every 10 seconds
- [ ] Admin dashboard refreshes every 5 seconds
- [ ] Changes reflect immediately after action

### ✅ Error Handling
- [ ] Invalid OTP shows error
- [ ] Network errors show toast
- [ ] Form validation works
- [ ] Unauthorized access blocked

---

## 🎨 UI/UX Features

### Responsive Design
- Works on desktop, tablet, and mobile
- Tailwind CSS for styling

### Notifications
- Success/error toasts using react-hot-toast
- Clear feedback for all actions

### Loading States
- Spinners while fetching data
- Disabled buttons during submission
- Loading text on buttons

### Visual Feedback
- Color-coded status badges
- Icons for different states
- Progress steps in onboarding flow

---

## 🔧 Troubleshooting

### Frontend not loading
```bash
cd client
npm install
npm run dev
```

### Backend not responding
```bash
# Check if backend is running
# Should see: Server running on port 4000
```

### CORS errors
- Backend should have `app.use(cors())` in `src/app.ts`
- Check browser console for errors

### Documents not uploading
- Currently using mock upload (returns fake URLs)
- Check console for upload logs
- Real upload needs S3/Cloudinary integration

### Status not updating
- Check auto-refresh is working (every 10s)
- Manually refresh page
- Check browser console for errors

---

## 📝 API Endpoints Being Tested

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/otp/send` | POST | Send OTP |
| `/api/auth/otp/verify` | POST | Verify OTP & create profile |
| `/api/onboarding/societies` | GET | List societies |
| `/api/onboarding/societies/:id/blocks` | GET | List blocks |
| `/api/onboarding/societies/:id/blocks/:blockId/flats` | GET | List flats |
| `/api/onboarding/request` | POST | Submit onboarding |
| `/api/onboarding/status` | GET | Get status |
| `/api/onboarding/admin/pending` | GET | List pending (admin) |
| `/api/onboarding/admin/:id` | GET | Get details (admin) |
| `/api/onboarding/admin/:id/approve` | PATCH | Approve (admin) |
| `/api/onboarding/admin/:id/reject` | PATCH | Reject (admin) |
| `/api/onboarding/admin/:id/request-resubmit` | PATCH | Request resubmit (admin) |

---

## 🎯 Success Criteria

Your APIs are working correctly if:

✅ Resident can complete full onboarding flow
✅ Admin can see pending requests
✅ Admin can approve/reject/request resubmit
✅ Status updates in real-time
✅ All CRUD operations work
✅ Error handling is proper
✅ Authentication works
✅ Authorization is enforced

---

## 📞 Support

If you encounter any issues:

1. Check browser console for errors
2. Check backend logs in terminal
3. Verify database has seed data
4. Check `.env` file has correct API URL
5. Restart both frontend and backend

---

**Happy Testing! 🚀**
