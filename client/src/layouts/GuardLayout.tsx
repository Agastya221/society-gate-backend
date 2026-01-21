import { useNavigate, Outlet } from 'react-router-dom';
import { ShieldCheck, History, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function GuardLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col max-w-md mx-auto shadow-2xl relative">
      <header className="bg-slate-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
            <ShieldCheck className="text-emerald-400" />
            <span className="font-bold text-lg">Guard Station</span>
        </div>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-white">
            <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-4">
        <Outlet />
      </main>

      <nav className="bg-slate-800 p-2 border-t border-slate-700 flex justify-around items-center h-16">
         <button 
           onClick={() => navigate('/guard/dashboard')} 
           className="flex flex-col items-center justify-center w-full h-full text-slate-300 active:text-white"
         >
            <ShieldCheck size={24} />
            <span className="text-xs mt-1">Duty</span>
         </button>
         <button 
           onClick={() => navigate('/guard/entries')} 
           className="flex flex-col items-center justify-center w-full h-full text-slate-300 active:text-white"
         >
            <History size={24} />
            <span className="text-xs mt-1">Logs</span>
         </button>
         <button 
           className="flex flex-col items-center justify-center w-full h-full text-slate-300 active:text-white"
         >
            <Menu size={24} />
            <span className="text-xs mt-1">More</span>
         </button>
      </nav>
    </div>
  );
}
