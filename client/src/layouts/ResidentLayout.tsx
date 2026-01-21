import { useNavigate } from 'react-router-dom';
import { Home, List, PlusCircle, Bell, User } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';

export default function ResidentLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative">
      <main className="flex-1 overflow-y-auto pb-20 bg-slate-50 relative">
        <PageTransition />
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-50">
        <NavButton icon={<Home size={24} />} label="Home" path="/resident/home" />
        <NavButton icon={<List size={24} />} label="Activity" path="/resident/entries" />
        <div className="relative -top-5">
           <button 
             onClick={() => navigate('/resident/quick-actions')}
             className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition"
           >
             <PlusCircle size={28} />
           </button>
        </div>
        <NavButton icon={<Bell size={24} />} label="Updates" path="/resident/notices" />
        <NavButton icon={<User size={24} />} label="Profile" path="/resident/profile" />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, path }: { icon: any; label: string; path: string }) {
  const navigate = useNavigate();
  const isActive = location.pathname === path;
  
  return (
    <button 
      onClick={() => navigate(path)}
      className={`flex flex-col items-center space-y-1 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
