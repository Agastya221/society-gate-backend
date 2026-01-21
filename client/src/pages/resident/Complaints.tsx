import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Camera, Send } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function Complaints() {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Helep & Support</h1>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        {['NEW', 'HISTORY'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === tab 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                {tab === 'NEW' ? 'New Complaint' : 'History'}
            </button>
        ))}
      </div>

      {activeTab === 'NEW' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="p-6">
                 <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        <option>Electrical</option>
                        <option>Plumbing</option>
                        <option>Housekeeping</option>
                        <option>Security</option>
                        <option>Other</option>
                    </select>
                 </div>

                 <div className="mb-4">
                     <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                     <textarea 
                        rows={4} 
                        className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Describe the issue in detail..."
                     />
                 </div>

                 <div className="mb-6">
                     <label className="block text-sm font-medium text-gray-700 mb-2">Photo (Optional)</label>
                     <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">
                         <Camera size={24} className="mb-2" />
                         <span className="text-sm">Tap to upload</span>
                     </div>
                 </div>

                 <Button fullWidth size="lg">
                     <Send size={18} className="mr-2" /> Submit Complaint
                 </Button>
            </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Card className="p-4 border-l-4 border-l-amber-500">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">IN PROGRESS</span>
                    <span className="text-xs text-gray-400">2 days ago</span>
                </div>
                <h3 className="font-semibold text-gray-800">Leaking tap in master bathroom</h3>
                <p className="text-sm text-gray-500 mt-1">Plumbing • Assigned to Maintenance Team</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-green-500 opacity-60">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">RESOLVED</span>
                    <span className="text-xs text-gray-400">1 week ago</span>
                </div>
                <h3 className="font-semibold text-gray-800">Lift light not working</h3>
                <p className="text-sm text-gray-500 mt-1">Electrical • Block A Lift 2</p>
            </Card>
        </motion.div>
      )}
    </div>
  );
}
