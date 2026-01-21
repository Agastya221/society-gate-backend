import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import OnboardingFlow from './pages/OnboardingFlow';
import OnboardingStatus from './pages/OnboardingStatus';
import AdminLayout from './layouts/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import OnboardingRequests from './pages/admin/OnboardingRequests';
import ResidentLayout from './layouts/ResidentLayout';
import ResidentHome from './pages/resident/ResidentHome';
import GuardLayout from './layouts/GuardLayout';
import GuardDashboard from './pages/guard/GuardDashboard';
import VisitorEntry from './pages/guard/VisitorEntry';
import QRScanner from './pages/guard/QRScanner';
import EntryLog from './pages/guard/EntryLog';
import EntryApprovals from './pages/resident/EntryApprovals';
import QuickActions from './pages/resident/QuickActions';
import PreApprovals from './pages/resident/PreApprovals';
import GatePasses from './pages/resident/GatePasses';
import Amenities from './pages/resident/Amenities';
import Complaints from './pages/resident/Complaints';
import Notices from './pages/resident/Notices';
import Payments from './pages/resident/Payments';
import AdminNotices from './pages/admin/AdminNotices';
import { useAuth } from './hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their appropriate dashboard if they try to access unauthorized route
    if (user.role === 'RESIDENT') return <Navigate to="/resident/home" />;
    if (user.role === 'GUARD') return <Navigate to="/guard/dashboard" />;
    if (user.role === 'ADMIN') return <Navigate to="/admin" />;
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            {/* Onboarding Routes */}
            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <OnboardingFlow />
                </PrivateRoute>
              }
            />
            <Route
              path="/status"
              element={
                <PrivateRoute>
                  <OnboardingStatus />
                </PrivateRoute>
              }
            />

            {/* Resident Routes */}
            <Route
              path="/resident"
              element={
                <PrivateRoute allowedRoles={['RESIDENT', 'ADMIN']}>
                  <ResidentLayout />
                </PrivateRoute>
              }
            >
              <Route path="home" element={<ResidentHome />} />
              <Route path="entries" element={<EntryApprovals />} />
              <Route path="quick-actions" element={<QuickActions />} />
              <Route path="pre-approvals" element={<PreApprovals />} />
              <Route path="gate-pass" element={<GatePasses />} />
              <Route path="amenities" element={<Amenities />} />
              <Route path="complaints" element={<Complaints />} />
              <Route path="payments" element={<Payments />} />
              <Route path="notices" element={<Notices />} />
              <Route path="profile" element={<div>Profile</div>} />
              <Route index element={<Navigate to="home" />} />
            </Route>

            {/* Guard Routes */}
            <Route
              path="/guard"
              element={
                <PrivateRoute allowedRoles={['GUARD', 'ADMIN']}>
                  <GuardLayout />
                </PrivateRoute>
              }
            >
              <Route path="dashboard" element={<GuardDashboard />} />
              <Route path="visitor-entry" element={<VisitorEntry />} />
              <Route path="scan" element={<QRScanner />} />
              <Route path="entries" element={<EntryLog />} />
              <Route index element={<Navigate to="dashboard" />} />
            </Route>

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                  <AdminLayout />
                </PrivateRoute>
              }
            >
               <Route path="overview" element={<AdminOverview />} />
               <Route path="onboarding" element={<OnboardingRequests />} />
               <Route path="notices" element={<AdminNotices />} />
               <Route path="settings" element={<div>Settings</div>} />
               <Route index element={<Navigate to="overview" />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
