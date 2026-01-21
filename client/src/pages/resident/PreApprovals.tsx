import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, Share2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { residentAPI } from '../../api/resident';

export default function PreApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    visitorName: '',
    visitorPhone: '',
    visitorType: 'GUEST',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date().toISOString().split('T')[0],
  });

  const { data: preApprovals } = useQuery({
    queryKey: ['preapprovals'],
    queryFn: async () => {
       // Mock
       return [
         { id: '1', visitorName: 'Mom & Dad', visitorType: 'FAMILY', validUntil: '2026-02-01', code: '123456' },
       ];
       // return (await residentAPI.getPreApprovals()).data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => residentAPI.createPreApproval(data),
    onSuccess: () => {
      toast.success('Pre-approval created!');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['preapprovals'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => residentAPI.cancelPreApproval(id),
    onSuccess: () => {
      toast.success('Cancelled');
      queryClient.invalidateQueries({ queryKey: ['preapprovals'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="mr-3">
            <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold">Pre-Approve Entry</h1>
      </div>

      {!showForm ? (
        <>
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-4 border-2 border-dashed border-indigo-300 rounded-xl flex items-center justify-center text-indigo-600 font-medium mb-8 hover:bg-indigo-50"
          >
            <Plus className="mr-2" />
            Create New Pre-Approval
          </button>

          <h2 className="text-lg font-semibold mb-4">Active Pre-Approvals</h2>
          <div className="space-y-4">
            {preApprovals?.map((item: any) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="flex justify-between">
                    <div>
                        <h3 className="font-bold text-lg">{item.visitorName}</h3>
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{item.visitorType}</span>
                        <div className="flex items-center text-gray-500 text-xs mt-2">
                            <Calendar size={12} className="mr-1" />
                            Valid until {item.validUntil}
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${item.code || item.id}`} 
                            alt="QR" 
                            className="w-20 h-20 rounded-lg" // Reduced size for better layout
                        />
                        <button className="text-indigo-600 text-xs font-medium mt-1 flex items-center">
                            <Share2 size={12} className="mr-1" /> Share
                        </button>
                    </div>
                </div>
                <button 
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500"
                >
                    <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visitor Name</label>
                <input 
                    type="text" 
                    required
                    className="w-full p-2 border rounded-lg"
                    value={formData.visitorName}
                    onChange={e => setFormData({...formData, visitorName: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input 
                    type="tel" 
                    required
                    className="w-full p-2 border rounded-lg"
                    value={formData.visitorPhone}
                    onChange={e => setFormData({...formData, visitorPhone: e.target.value})}
                />
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select 
                    className="w-full p-2 border rounded-lg"
                    value={formData.visitorType}
                    onChange={e => setFormData({...formData, visitorType: e.target.value})}
                >
                    <option value="GUEST">Guest</option>
                    <option value="FAMILY">Family</option>
                    <option value="FRIEND">Friend</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="CAB">Cab</option>
                    <option value="OTHER">Other</option>
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                   <input type="date" className="w-full p-2 border rounded-lg" value={formData.validFrom} onChange={e => setFormData({...formData, validFrom: e.target.value})} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                   <input type="date" className="w-full p-2 border rounded-lg" value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
                </div>
            </div>

            <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-gray-600 font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-indigo-200">Create Pass</button>
            </div>
        </form>
      )}
    </div>
  );
}
