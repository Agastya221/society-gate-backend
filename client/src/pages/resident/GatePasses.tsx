import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Truck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { residentAPI } from '../../api/resident';

export default function GatePasses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    type: 'MATERIAL', // MATERIAL, VEHICLE, MOVE_IN, MOVE_OUT
    title: '',
    description: '',
    validFrom: new Date().toISOString().split('T')[0],
  });

  const { data: gatePasses } = useQuery({
    queryKey: ['gatepasses'],
    queryFn: async () => {
       // Mock
       return [
         { id: '1', type: 'MATERIAL', title: 'Sofa Repair', status: 'ACTIVE', created: '2025-10-10' },
       ];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => residentAPI.createGatePass(data),
    onSuccess: () => {
      toast.success('Gate pass requested!');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['gatepasses'] });
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
        <h1 className="text-2xl font-bold">Gate Passes</h1>
      </div>

      {!showForm ? (
        <>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    onClick={() => { setFormData({...formData, type: 'MATERIAL'}); setShowForm(true); }}
                    className="p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-orange-50 hover:border-orange-200 transition"
                >
                    <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Archive /></div>
                    <span className="font-semibold text-sm">Material Move</span>
                </button>
                 <button
                    onClick={() => { setFormData({...formData, type: 'VEHICLE'}); setShowForm(true); }}
                    className="p-4 border rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-200 transition"
                >
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600"><Truck /></div>
                    <span className="font-semibold text-sm">Vehicle Pass</span>
                </button>
            </div>

            <h2 className="text-lg font-semibold mb-4">Active Passes</h2>
            <div className="space-y-4">
                {gatePasses?.map((pass: any) => (
                    <div key={pass.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                             <div className="flex items-center space-x-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pass.type === 'MATERIAL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {pass.type}
                                </span>
                                <span className="text-xs text-gray-500">{pass.created}</span>
                             </div>
                             <h3 className="font-semibold">{pass.title}</h3>
                        </div>
                        <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                {pass.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </>
      ) : (
         <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="font-bold text-lg mb-4">New {formData.type} Pass</h3>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title / Item Name</label>
                <input 
                    type="text" 
                    required
                    placeholder={formData.type === 'MATERIAL' ? "e.g. Old Sofa Set" : "e.g. Painting Service Truck"}
                    className="w-full p-2 border rounded-lg"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                    className="w-full p-2 border rounded-lg"
                    rows={3}
                    placeholder="Add details about items or vehicle..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                />
            </div>
            <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                   <input type="date" className="w-full p-2 border rounded-lg" value={formData.validFrom} onChange={e => setFormData({...formData, validFrom: e.target.value})} />
            </div>

            <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-gray-600 font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-indigo-200">Request Pass</button>
            </div>
         </form>
      )}
    </div>
  );
}
