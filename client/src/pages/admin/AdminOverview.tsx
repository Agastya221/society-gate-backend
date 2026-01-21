import { Users, Shield, Home, AlertCircle, BarChart3, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';

export default function AdminOverview() {
  const stats = [
    { label: 'Total Residents', value: '1,240', change: '+12%', icon: <Users className="text-indigo-600" />, bg: 'bg-indigo-50' },
    { label: 'On Duty Guards', value: '8', change: 'Online', icon: <Shield className="text-emerald-600" />, bg: 'bg-emerald-50' },
    { label: 'Total Flats', value: '450', change: '98% Occupied', icon: <Home className="text-blue-600" />, bg: 'bg-blue-50' },
    { label: 'Pending Approvals', value: '12', change: 'Urgent', icon: <AlertCircle className="text-orange-600" />, bg: 'bg-orange-50' },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  {stat.icon}
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-gray-500 text-sm">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Card className="p-6 h-80 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800">Activity Overview</h3>
                    <BarChart3 className="text-gray-400" />
                </div>
                <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                   <p className="text-gray-400 text-sm">Activity Chart Component</p>
                </div>
            </Card>
         </motion.div>

         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Card className="p-6 h-80 flex flex-col">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800">Recent Logs</h3>
                    <Activity className="text-gray-400" />
                </div>
                <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                   <p className="text-gray-400 text-sm">Recent Logs List</p>
                </div>
            </Card>
         </motion.div>
      </div>
    </div>
  );
}
