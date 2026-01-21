import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, User, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { residentAPI } from '../../api/resident';

export default function EntryApprovals() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'PENDING' | 'HISTORY'>('PENDING');

  // Fetch pending entries
  const { data: pendingEntries, isLoading: loadingPending } = useQuery({
    queryKey: ['entries', 'pending'],
    queryFn: async () => {
      // Mock data for now until backend is ready
      // const res = await residentAPI.getPendingEntries();
      // return res.data.data;
        return [
            { id: '1', visitorName: 'Raju Plumber', type: 'VENDOR', purpose: 'Tap repair', timestamp: new Date().toISOString() },
            { id: '2', visitorName: 'Zomato', type: 'DELIVERY', company: 'Zomato', timestamp: new Date().toISOString() }
        ]
    },
  });

  const approveMutation = useMutation({
    mutationFn: residentAPI.approveEntry,
    onSuccess: () => {
      toast.success('Entry Approved');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => residentAPI.rejectEntry(id),
    onSuccess: () => {
      toast.error('Entry Rejected');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6">Activity Log</h1>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
        <button
          onClick={() => setFilter('PENDING')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            filter === 'PENDING' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('HISTORY')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            filter === 'HISTORY' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'
          }`}
        >
          History
        </button>
      </div>

      {filter === 'PENDING' && (
        <div className="space-y-4">
          {loadingPending ? (
            <p className="text-center text-gray-500">Loading...</p>
          ) : pendingEntries?.length === 0 ? (
            <div className="text-center py-12">
               <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Check className="text-gray-400" size={32} />
               </div>
               <p className="text-gray-500">No pending approvals</p>
            </div>
          ) : (
            pendingEntries?.map((entry: any) => (
              <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                      {entry.type === 'DELIVERY' ? <Package size={20} /> : <User size={20} />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{entry.visitorName}</h3>
                      <p className="text-xs text-gray-500">{entry.type} • {entry.company || entry.purpose}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-orange-500 font-medium">
                    <Clock size={12} className="mr-1" />
                    Pending
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => rejectMutation.mutate(entry.id)}
                    className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(entry.id)}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {filter === 'HISTORY' && (
          <div className="text-center text-gray-500 py-8">
              No history available yet.
          </div>
      )}
    </div>
  );
}
