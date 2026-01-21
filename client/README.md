# Society Gate - Frontend Testing Client

This is a web-based testing client for the Society Gate backend API. It allows you to test the complete resident onboarding flow including OTP verification, society/block/flat selection, document upload, and admin approval workflow.

## Features

### Resident Features
- ✅ **OTP-based Login** - Phone number verification with OTP
- ✅ **Profile Creation** - Name and email input during signup
- ✅ **Society Selection** - Browse and select from available societies
- ✅ **Block/Tower Selection** - Choose your building/tower
- ✅ **Flat Selection** - Pick your flat number
- ✅ **Role Selection** - Specify if you're an Owner or Tenant
- ✅ **Document Upload** - Upload ownership proof/tenant agreement and ID proofs
- ✅ **Status Tracking** - Real-time onboarding status updates
- ✅ **Auto-refresh** - Status page refreshes every 10 seconds

### Admin Features
- ✅ **Dashboard** - View all pending onboarding requests
- ✅ **Request Review** - Detailed view of resident information and documents
- ✅ **Approve Requests** - Activate residents with optional notes
- ✅ **Reject Requests** - Decline with mandatory reason
- ✅ **Request Resubmission** - Ask for better/additional documents
- ✅ **Auto-refresh** - Dashboard refreshes every 5 seconds

## Setup

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Configure Environment

Create a `.env` file in the `client` directory:

```bash
cp .env.example .env
```

Edit `.env` and set your API URL:

```
VITE_API_URL=http://localhost:4000/api
```

### 3. Start Development Server

```bash
npm run dev
```

The client will start at `http://localhost:5173`

## Usage

### Testing Resident Onboarding Flow

1. **Login/Signup**
   - Go to `http://localhost:5173`
   - Enter phone number (e.g., `9876543210`)
   - Click "Send OTP"
   - Enter any 6-digit OTP (in dev mode, any OTP works)
   - Enter your name and email
   - Click "Verify & Continue"

2. **Complete Onboarding**
   - Select your society from the list
   - Choose your block/tower
   - Pick your flat number
   - Select if you're an Owner or Tenant
   - Upload required documents:
     - **For Owners**: Ownership Proof + Aadhar Card
     - **For Tenants**: Tenant Agreement + Aadhar Card
   - Review and submit

3. **Check Status**
   - You'll be redirected to the status page
   - Status will show "PENDING_APPROVAL"
   - Page auto-refreshes every 10 seconds

### Testing Admin Approval Flow

1. **Login as Admin**
   - Use admin credentials from `TEST_CREDENTIALS.md`
   - Phone: `9876543210` (Society Admin)
   - Password: `admin123`

2. **Review Requests**
   - Go to Admin Dashboard
   - See all pending requests in a table
   - Click "Review" on any request

3. **Take Action**
   - **Approve**: Activate the resident (optional notes)
   - **Reject**: Decline with reason (mandatory)
   - **Request Resubmit**: Ask for better documents (mandatory reason)

4. **Verify Changes**
   - Resident's status page will update automatically
   - Approved residents get full access
   - Rejected/Resubmit requests show admin feedback

## API Endpoints Tested

### Authentication
- `POST /api/auth/otp/send` - Send OTP
- `POST /api/auth/otp/verify` - Verify OTP & create profile

### Onboarding (Resident)
- `GET /api/onboarding/societies` - List societies
- `GET /api/onboarding/societies/:id/blocks` - List blocks
- `GET /api/onboarding/societies/:id/blocks/:blockId/flats` - List flats
- `POST /api/onboarding/request` - Submit onboarding request
- `GET /api/onboarding/status` - Get onboarding status

### Onboarding (Admin)
- `GET /api/onboarding/admin/pending` - List pending requests
- `GET /api/onboarding/admin/:id` - Get request details
- `PATCH /api/onboarding/admin/:id/approve` - Approve request
- `PATCH /api/onboarding/admin/:id/reject` - Reject request
- `PATCH /api/onboarding/admin/:id/request-resubmit` - Request resubmission

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **TanStack Query** - Data fetching & caching
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

## Project Structure

```
client/
├── src/
│   ├── api/
│   │   └── client.ts          # API client with all endpoints
│   ├── hooks/
│   │   └── useAuth.ts         # Authentication hook
│   ├── pages/
│   │   ├── LoginPage.tsx      # OTP login & signup
│   │   ├── OnboardingFlow.tsx # Multi-step onboarding
│   │   ├── OnboardingStatus.tsx # Status tracking
│   │   └── AdminDashboard.tsx # Admin review panel
│   ├── App.tsx                # Main app with routing
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── .env.example               # Environment template
├── package.json
└── README.md
```

## Features to Test

### Edge Cases
- ✅ Duplicate flat claims (only 1 owner per flat)
- ✅ Multiple tenants (same flat can have multiple tenants)
- ✅ Document validation (required docs based on role)
- ✅ OTP rate limiting (check backend logs)
- ✅ Invalid OTP handling
- ✅ Unauthorized access (try accessing admin without login)

### User Experience
- ✅ Real-time status updates
- ✅ Form validation
- ✅ Error handling
- ✅ Loading states
- ✅ Success/error notifications
- ✅ Responsive design

## Troubleshooting

### Backend not responding
- Make sure backend is running: `npm run dev` in backend directory
- Check backend is on `http://localhost:4000`
- Verify `.env` has correct `VITE_API_URL`

### CORS errors
- Backend should have CORS enabled
- Check `src/app.ts` has `app.use(cors())`

### OTP not working
- In development, any 6-digit OTP should work
- Check backend console for OTP logs
- Verify MSG91 is configured (or mocked)

### Documents not uploading
- Currently using mock upload (returns fake URLs)
- For real uploads, integrate S3/Cloudinary in backend
- Update `uploadAPI.uploadDocument()` in `api/client.ts`

## Next Steps

1. **Integrate Real File Upload**
   - Add S3/Cloudinary backend endpoint
   - Update `uploadAPI.uploadDocument()` to call real API

2. **Add More Features**
   - Notifications page
   - Entry requests
   - Gate passes
   - Amenity bookings

3. **Improve UI**
   - Add animations
   - Better mobile responsiveness
   - Dark mode

4. **Testing**
   - Add unit tests
   - E2E tests with Playwright
   - API integration tests

## License

MIT
