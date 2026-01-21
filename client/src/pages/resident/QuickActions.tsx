import { useNavigate } from 'react-router-dom';
import { UserPlus, Truck, ShieldAlert, Wrench, Package } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { icon: <UserPlus className="text-indigo-600" size={28} />, label: 'Pre-Approve Guest', path: '/resident/pre-approvals', color: 'bg-indigo-50 border-indigo-100' },
    { icon: <Truck className="text-blue-600" size={28} />, label: 'Gate Pass', path: '/resident/gate-pass', color: 'bg-blue-50 border-blue-100' },
    { icon: <Wrench className="text-orange-600" size={28} />, label: 'Book Amenity', path: '/resident/amenities', color: 'bg-orange-50 border-orange-100' },
    { icon: <Package className="text-purple-600" size={28} />, label: 'Deliveries', path: '/resident/deliveries', color: 'bg-purple-50 border-purple-100' },
    { icon: <ShieldAlert className="text-red-600" size={28} />, label: 'SOS Alert', path: '/resident/sos', color: 'bg-red-50 border-red-100' },
  ];

  return (
    <div className="p-4">
      <div className="flex items-center mb-6">
          <button onClick={() => navigate(-1)} className="mr-3">
              <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">Quick Actions</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center space-y-3 transition active:scale-95 ${action.color}`}
          >
            <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center">
              {action.icon}
            </div>
            <span className="font-semibold text-gray-800 text-sm">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
