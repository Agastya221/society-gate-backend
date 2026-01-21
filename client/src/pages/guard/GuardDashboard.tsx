import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, QrCode, AlertTriangle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
// import { guardAPI } from '../../api/guard';

export default function GuardDashboard() {
  const navigate = useNavigate();

  const { data: todayEntries } = useQuery({
    queryKey: ['entries', 'today'],
    queryFn: async () => {
        // Mock
        return { count: 12, checkedIn: 5 };
    }
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['entry-requests', 'pending'],
    queryFn: async () => {
        // Mock
        return 2;
    }
  });

  return (
    <div className="p-4 space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg"
        >
           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Entries Today</span>
           <div className="flex items-end mt-2">
             <span className="text-4xl font-extrabold text-white">{todayEntries?.count || 0}</span>
             <span className="text-emerald-400 text-sm ml-2 mb-1.5 font-medium">{todayEntries?.checkedIn || 0} In</span>
           </div>
        </motion.div>
        
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-lg"
        >
           <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pending</span>
            <div className="flex items-end mt-2">
             <span className="text-4xl font-extrabold text-amber-500">{pendingRequests || 0}</span>
             <span className="text-slate-500 text-sm ml-2 mb-1.5 font-medium">Reqs</span>
           </div>
        </motion.div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-4 h-48">
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/guard/visitor-entry')}
            className="bg-indigo-600 rounded-2xl flex flex-col items-center justify-center space-y-4 hover:bg-indigo-700 transition shadow-xl shadow-indigo-900/30 group relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="bg-indigo-500 p-4 rounded-full shadow-inner ring-4 ring-indigo-500/30">
                <UserPlus size={32} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-wide">New Entry</span>
        </motion.button>

         <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/guard/scan')}
            className="bg-emerald-600 rounded-2xl flex flex-col items-center justify-center space-y-4 hover:bg-emerald-700 transition shadow-xl shadow-emerald-900/30 group relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="bg-emerald-500 p-4 rounded-full shadow-inner ring-4 ring-emerald-500/30">
                <QrCode size={32} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-wide">Scan QR</span>
        </motion.button>
      </div>

      <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/guard/entries')}
            className="w-full bg-slate-700 rounded-xl p-4 flex items-center justify-center space-x-3 hover:bg-slate-600 transition border border-slate-600"
      >
          <FileText className="text-slate-300" />
          <span className="text-slate-200 font-semibold">View Entry Logs</span>
      </motion.button>

       {/* Emergency Alert */}
       <div className="bg-red-900/20 border border-red-900/50 p-4 rounded-2xl flex items-center space-x-4">
            <div className="bg-red-500 p-2 rounded-full animate-pulse shadow-lg shadow-red-900/40">
                <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
                <h3 className="font-bold text-red-400 text-lg">SOS Alert</h3>
                <p className="text-red-300/60 text-sm">System Normal</p>
            </div>
       </div>
    </div>
  );
}
