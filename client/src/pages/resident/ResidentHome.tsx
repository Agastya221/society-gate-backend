import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  CreditCard, 
  LifeBuoy, 
  AlertTriangle, 
  CloudSun, 
  ChevronRight,
  Bell
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';

export default function ResidentHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="pb-24">
      {/* Header Section */}
      <div className="bg-indigo-600 text-white rounded-b-3xl p-6 shadow-xl shadow-indigo-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl -ml-10 -mb-10" />
        
        <div className="relative z-10 flex justify-between items-start mb-6">
            <div>
                <p className="text-indigo-100 text-sm mb-1">{(user as any)?.flat?.societyName || 'Skyline Residency'}</p>
                <h1 className="text-3xl font-bold">Hello, {user?.name?.split(' ')[0] || 'Resident'}</h1>
                <p className="text-indigo-100/80 text-sm mt-1">{(user as any)?.flat?.block}-{(user as any)?.flat?.flatNumber || '000'}</p>
            </div>
            <button className="p-2 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 transition-colors">
                <Bell size={20} />
            </button>
        </div>

        {/* Weather Widget Mock */}
        <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <CloudSun size={32} className="text-yellow-300" />
            <div>
                <p className="text-2xl font-bold">28°C</p>
                <p className="text-xs text-indigo-100">Partly Cloudy • Bangalore</p>
            </div>
        </div>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="px-4 -mt-6 relative z-10"
      >
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div variants={item}>
                <Card className="p-4 bg-white shadow-lg shadow-amber-500/10 border-l-4 border-l-amber-500">
                    <span className="block text-3xl font-bold text-gray-800">2</span>
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Pending</span>
                </Card>
            </motion.div>
            <motion.div variants={item}>
                <Card className="p-4 bg-white shadow-lg shadow-blue-500/10 border-l-4 border-l-blue-500">
                    <span className="block text-3xl font-bold text-gray-800">5</span>
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Notices</span>
                </Card>
            </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-lg font-bold text-gray-800">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
                {[
                    { icon: Plus, label: 'Guest', color: 'bg-indigo-100 text-indigo-600', path: '/resident/pre-approvals' },
                    { icon: CreditCard, label: 'Pay', color: 'bg-emerald-100 text-emerald-600', path: '/resident/payments' },
                    { icon: LifeBuoy, label: 'Help', color: 'bg-purple-100 text-purple-600', path: '/resident/complaints' },
                    { icon: AlertTriangle, label: 'SOS', color: 'bg-red-100 text-red-600', path: '/resident/quick-actions' },
                ].map((action, idx) => (
                    <motion.button
                        key={idx}
                        variants={item}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => action.path && navigate(action.path)}
                        className="flex flex-col items-center group"
                    >
                        <div className={`${action.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-sm group-hover:shadow-md transition-all`}>
                            <action.icon size={24} />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{action.label}</span>
                    </motion.button>
                ))}
            </div>
        </div>

        {/* Recent Activity */}
        <div>
             <div className="flex justify-between items-center mb-4 px-1">
                <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
                <button 
                  onClick={() => navigate('/resident/entries')}
                  className="text-xs text-indigo-600 font-semibold flex items-center"
                >
                    View All <ChevronRight size={14} />
                </button>
            </div>
            <div className="space-y-3">
                {[1, 2, 3].map((_, i) => (
                     <motion.div key={i} variants={item}>
                        <Card className="p-4 flex justify-between items-center" hoverEffect>
                             <div className="flex items-center space-x-3">
                                 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                                     AM
                                 </div>
                                 <div>
                                     <p className="font-semibold text-gray-800 text-sm">Amazon Delivery</p>
                                     <p className="text-xs text-gray-500">Today, 10:30 AM</p>
                                 </div>
                             </div>
                             <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-md">
                                 Allowed
                             </span>
                        </Card>
                     </motion.div>
                ))}
            </div>
        </div>
      </motion.div>
    </div>
  );
}
