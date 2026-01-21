import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminOnboardingAPI } from '../../api/client';
// import { useNavigate } from 'react-router-dom';

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
  Users,
} from 'lucide-react';

export default function OnboardingRequests() {
  const queryClient = useQueryClient();
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'resubmit' | null>(null);
  const [reason, setReason] = useState('');

  // Fetch pending requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['admin-pending-requests'],
    queryFn: async () => {
      const response = await adminOnboardingAPI.getPendingRequests({
        status: 'PENDING_APPROVAL',
      });
      return response.data.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch request details
  const { data: requestDetails } = useQuery({
    queryKey: ['request-details', selectedRequest?.id],
    queryFn: async () => {
      const response = await adminOnboardingAPI.getRequestDetails(selectedRequest.id);
      return response.data.data;
    },
    enabled: !!selectedRequest,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) => adminOnboardingAPI.approveRequest(requestId, reason),
    onSuccess: () => {
      toast.success('Request approved successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-pending-requests'] });
      setShowModal(false);
      setSelectedRequest(null);
      setReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to approve request');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => adminOnboardingAPI.rejectRequest(requestId, reason),
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-pending-requests'] });
      setShowModal(false);
      setSelectedRequest(null);
      setReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to reject request');
    },
  });

  // Resubmit mutation
  const resubmitMutation = useMutation({
    mutationFn: (requestId: string) =>
      adminOnboardingAPI.requestResubmit(requestId, reason),
    onSuccess: () => {
      toast.success('Resubmission requested');
      queryClient.invalidateQueries({ queryKey: ['admin-pending-requests'] });
      setShowModal(false);
      setSelectedRequest(null);
      setReason('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to request resubmission');
    },
  });

  const handleAction = () => {
    if (!selectedRequest) return;

    if (actionType === 'approve') {
      approveMutation.mutate(selectedRequest.id);
    } else if (actionType === 'reject') {
      if (!reason.trim()) {
        toast.error('Please provide a reason for rejection');
        return;
      }
      rejectMutation.mutate(selectedRequest.id);
    } else if (actionType === 'resubmit') {
      if (!reason.trim()) {
        toast.error('Please provide a reason for resubmission');
        return;
      }
      resubmitMutation.mutate(selectedRequest.id);
    }
  };



  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Onboarding Requests</h1>

        {/* Requests Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold">Pending Onboarding Requests</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading requests...</p>
            </div>
          ) : requestsData?.requests?.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Resident
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Flat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Documents
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requestsData?.requests?.map((request: any) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{request.resident.name}</p>
                          <p className="text-sm text-gray-500">{request.resident.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{request.flat.flatNumber}</p>
                        <p className="text-sm text-gray-500">{request.flat.block}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            request.residentType === 'OWNER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {request.residentType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-gray-400 mr-1" />
                          <span className="text-sm">{request.documentsCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(request.submittedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowModal(true);
                          }}
                          className="flex items-center text-indigo-600 hover:text-indigo-900"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold">Review Onboarding Request</h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Resident Info */}
              <div>
                <h3 className="font-semibold mb-3">Resident Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium">{requestDetails?.resident.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium">{requestDetails?.resident.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{requestDetails?.resident.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{requestDetails?.residentType}</p>
                  </div>
                </div>
              </div>

              {/* Property Info */}
              <div>
                <h3 className="font-semibold mb-3">Property Details</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Block</p>
                    <p className="font-medium">{requestDetails?.block}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Flat</p>
                    <p className="font-medium">{requestDetails?.flat}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Society</p>
                    <p className="font-medium">{requestDetails?.society}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="font-semibold mb-3">Documents</h3>
                <div className="space-y-2">
                  {requestDetails?.documents?.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-sm">{doc.documentType.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                        </div>
                      </div>
                      <a
                        href={doc.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-sm"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Selection */}
              {!actionType && (
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => setActionType('approve')}
                    className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Approve
                  </button>
                  <button
                    onClick={() => setActionType('resubmit')}
                    className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Request Resubmit
                  </button>
                  <button
                    onClick={() => setActionType('reject')}
                    className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    Reject
                  </button>
                </div>
              )}

              {/* Reason Input */}
              {(actionType === 'reject' || actionType === 'resubmit') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason {actionType === 'reject' ? 'for Rejection' : 'for Resubmission'} *
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Please provide a detailed reason..."
                  />
                </div>
              )}

              {actionType === 'approve' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Add any notes..."
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t flex justify-end gap-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedRequest(null);
                  setActionType(null);
                  setReason('');
                }}
                className="px-6 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              {actionType && (
                <button
                  onClick={handleAction}
                  disabled={
                    approveMutation.isPending ||
                    rejectMutation.isPending ||
                    resubmitMutation.isPending
                  }
                  className={`px-6 py-2 rounded-lg font-semibold text-white ${
                    actionType === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : actionType === 'resubmit'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {approveMutation.isPending ||
                  rejectMutation.isPending ||
                  resubmitMutation.isPending
                    ? 'Processing...'
                    : `Confirm ${actionType === 'approve' ? 'Approval' : actionType === 'resubmit' ? 'Resubmission' : 'Rejection'}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
