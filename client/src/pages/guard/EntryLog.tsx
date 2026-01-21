import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { guardAPI } from '../../api/guard';

export default function EntryLog() {
  const queryClient = useQueryClient();
  const [filter] = useState('ALL'); // ALL, CHECKED_IN

  const { data: entries } = useQuery({
    queryKey: ['entries', 'log', filter],
    queryFn: async () => {
       // Mock
       return [
         { id: '1', visitorName: 'Rohan Guest', type: 'VISITOR', status: 'CHECKED_IN', inTime: '10:30 AM', flatId: 'A-101' },
         { id: '2', visitorName: 'Amazon Delivery', type: 'DELIVERY', status: 'CHECKED_OUT', inTime: '09:15 AM', outTime: '09:30 AM', flatId: 'B-205' },
       ];
    //    return (await guardAPI.getTodayEntries()).data.data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (id: string) => guardAPI.checkoutEntry(id),
    onSuccess: () => {
      toast.success('Visitor Checked Out');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6 text-white">Entry Log</h1>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 bg-slate-800 rounded-lg flex items-center px-3 border border-slate-700">
            <Search size={18} className="text-slate-500 mr-2" />
            <input 
                type="text" 
                placeholder="Search visitor or flat..." 
                className="bg-transparent border-none outline-none text-white py-2 w-full placeholder-slate-500"
            />
        </div>
        <button className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-400">
            <Filter size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {entries?.map((entry: any) => (
            <div key={entry.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center space-x-2">
                             <h3 className="font-bold text-white text-lg">{entry.visitorName}</h3>
                             <span className="text-xs font-mono bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                                {entry.flatId}
                             </span>
                        </div>
                        <p className="text-slate-400 text-sm">{entry.type}</p>
                    </div>
                     <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                        entry.status === 'CHECKED_IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                     }`}>
                        {entry.status}
                    </span>
                </div>

                <div className="mt-4 flex justify-between items-center border-t border-slate-700 pt-3">
                    <div className="text-slate-500 text-xs flex items-center">
                        <Clock size={12} className="mr-1" />
                        In: {entry.inTime}
                        {entry.outTime && <span className="ml-2">Out: {entry.outTime}</span>}
                    </div>

                    {entry.status === 'CHECKED_IN' && (
                        <button 
                            onClick={() => checkoutMutation.mutate(entry.id)}
                            className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 flex items-center"
                        >
                            <LogOut size={12} className="mr-1" /> Checkout
                        </button>
                    )}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}
