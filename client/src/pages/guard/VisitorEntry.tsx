import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, User, Truck, Car } from 'lucide-react';
import toast from 'react-hot-toast';
import { guardAPI } from '../../api/guard';
import { uploadAPI } from '../../api/client';

export default function VisitorEntry() {
  // const queryClient = useQueryClient();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    flatId: '',
    visitorName: '',
    visitorPhone: '',
    type: 'VISITOR', // VISITOR, DELIVERY, CAB
    providerTag: '', // For deliveries
  });

  const entryMutation = useMutation({
    mutationFn: async (data: any) => {
      let photoKey = null;
      if (photo) {
        // Upload photo first
        const uploadRes = await uploadAPI.uploadDocument(photo);
        photoKey = uploadRes.url; // In real app, this would be the key
      }
      
      return guardAPI.createEntryRequest({
        ...data,
        photoKey
      });
    },
    onSuccess: () => {
      toast.success('Entry request sent to resident!');
      setFormData({
        flatId: '',
        visitorName: '',
        visitorPhone: '',
        type: 'VISITOR',
        providerTag: '',
      });
      setPhoto(null);
      setPhotoPreview(null);
    },
    onError: () => toast.error('Failed to create entry'),
  });

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    entryMutation.mutate(formData);
  };

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6 text-white">New Entry</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry Type Selector */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'VISITOR' })}
            className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 transition ${
              formData.type === 'VISITOR' 
                ? 'bg-indigo-600 border-indigo-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <User />
            <span className="text-xs font-semibold">Visitor</span>
          </button>
          
          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'DELIVERY' })}
            className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 transition ${
              formData.type === 'DELIVERY' 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Truck />
            <span className="text-xs font-semibold">Delivery</span>
          </button>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, type: 'CAB' })}
            className={`p-3 rounded-xl flex flex-col items-center justify-center space-y-2 border-2 transition ${
              formData.type === 'CAB' 
                ? 'bg-amber-600 border-amber-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Car />
            <span className="text-xs font-semibold">Cab</span>
          </button>
        </div>

        {/* Photo Capture */}
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="camera-input"
            onChange={handlePhotoCapture}
          />
          <label
            htmlFor="camera-input"
            className="block w-full aspect-video bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 cursor-pointer overflow-hidden hover:bg-slate-750 transition"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
                <>
                    <Camera size={48} className="mb-2" />
                    <span className="font-medium">Take Photo</span>
                </>
            )}
          </label>
        </div>

        {/* Details Form */}
        <div className="space-y-4">
            <div>
               <label className="text-slate-400 text-sm mb-1 block">Flat Number</label>
               <input 
                 type="text" 
                 required
                 placeholder="e.g. A-101"
                 className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                 value={formData.flatId}
                 onChange={e => setFormData({ ...formData, flatId: e.target.value })}
               />
            </div>

            {formData.type === 'VISITOR' && (
                <>
                    <div>
                        <label className="text-slate-400 text-sm mb-1 block">Visitor Name</label>
                        <input 
                            type="text" 
                            required
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-indigo-500"
                            value={formData.visitorName}
                            onChange={e => setFormData({ ...formData, visitorName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 text-sm mb-1 block">Phone Number</label>
                        <input 
                            type="tel" 
                            required
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-indigo-500"
                            value={formData.visitorPhone}
                            onChange={e => setFormData({ ...formData, visitorPhone: e.target.value })}
                        />
                    </div>
                </>
            )}

            {formData.type === 'DELIVERY' && (
                <div>
                    <label className="text-slate-400 text-sm mb-1 block">Company</label>
                    <select
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-indigo-500"
                        value={formData.providerTag}
                        onChange={e => setFormData({ ...formData, providerTag: e.target.value })}
                    >
                        <option value="">Select Company</option>
                        <option value="SWIGGY">Swiggy</option>
                        <option value="ZOMATO">Zomato</option>
                        <option value="AMAZON">Amazon</option>
                        <option value="FLIPKART">Flipkart</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>
            )}
        </div>

        <button
            type="submit"
            disabled={entryMutation.isPending}
            className="w-full py-4 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition disabled:opacity-50"
        >
            {entryMutation.isPending ? 'Sending...' : 'Request Entry'}
        </button>
      </form>
    </div>
  );
}
