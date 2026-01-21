import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { onboardingAPI } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Home,
  LogOut,
} from 'lucide-react';

export default function OnboardingStatus() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      const response = await onboardingAPI.getStatus();
      return response.data.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading status...</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (statusData?.status) {
      case 'PENDING_APPROVAL':
        return <Clock className="w-16 h-16 text-yellow-500" />;
      case 'APPROVED':
        return <CheckCircle className="w-16 h-16 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="w-16 h-16 text-red-500" />;
      case 'RESUBMIT_REQUESTED':
        return <AlertCircle className="w-16 h-16 text-orange-500" />;
      default:
        return <Clock className="w-16 h-16 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (statusData?.status) {
      case 'PENDING_APPROVAL':
        return 'bg-yellow-50 border-yellow-200';
      case 'APPROVED':
        return 'bg-green-50 border-green-200';
      case 'REJECTED':
        return 'bg-red-50 border-red-200';
      case 'RESUBMIT_REQUESTED':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Onboarding Status</h1>
            <p className="text-gray-600 mt-1">Welcome, {user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </button>
        </div>

        {/* Status Card */}
        <div className={`bg-white rounded-xl shadow-lg p-8 border-2 ${getStatusColor()}`}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">{getStatusIcon()}</div>
            <h2 className="text-2xl font-bold mb-2">
              {statusData?.status?.replace(/_/g, ' ')}
            </h2>
            <p className="text-gray-600">{statusData?.message}</p>
          </div>

          {/* Details */}
          {statusData?.society && (
            <div className="space-y-4 mt-8">
              <div className="flex items-start">
                <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Society</p>
                  <p className="font-semibold">{statusData.society}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Block</p>
                  <p className="font-semibold">{statusData.block}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Home className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Flat</p>
                  <p className="font-semibold">{statusData.flat}</p>
                </div>
              </div>

              <div className="flex items-start">
                <FileText className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Resident Type</p>
                  <p className="font-semibold">{statusData.residentType}</p>
                </div>
              </div>
            </div>
          )}

          {/* Documents */}
          {statusData?.documents && statusData.documents.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-semibold mb-4">Uploaded Documents</h3>
              <div className="space-y-2">
                {statusData.documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <FileText className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <p className="font-medium text-sm">
                          {doc.documentType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500">{doc.fileName}</p>
                      </div>
                    </div>
                    {doc.isVerified ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection/Resubmit Reason */}
          {(statusData?.rejectionReason || statusData?.resubmitReason) && (
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">Admin Feedback</h3>
              <p className="text-red-700">
                {statusData.rejectionReason || statusData.resubmitReason}
              </p>
            </div>
          )}

          {/* Timestamps */}
          {statusData?.submittedAt && (
            <div className="mt-8 pt-6 border-t text-sm text-gray-600">
              <p>
                Submitted:{' '}
                {new Date(statusData.submittedAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              {statusData.approvedAt && (
                <p className="mt-1">
                  Approved:{' '}
                  {new Date(statusData.approvedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
              {statusData.rejectedAt && (
                <p className="mt-1">
                  Rejected:{' '}
                  {new Date(statusData.rejectedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {statusData?.status === 'APPROVED' && (
            <div className="mt-8">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <h3 className="font-semibold text-green-900 mb-1">
                  Welcome to {statusData.society}!
                </h3>
                <p className="text-green-700 text-sm">
                  Your account is now active. You can access all resident features.
                </p>
              </div>
            </div>
          )}

          {statusData?.status === 'NOT_STARTED' && (
            <div className="mt-8">
              <button
                onClick={() => navigate('/onboarding')}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                Start Onboarding
              </button>
            </div>
          )}
        </div>

        {/* Admin Link */}
        {user?.role === 'ADMIN' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/admin')}
              className="text-indigo-600 hover:underline"
            >
              Go to Admin Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
