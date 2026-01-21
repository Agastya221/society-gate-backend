import { useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '../../components/ui/Button'; // Assuming I can import this
// Actually Button is in ../../components/ui/Button.tsx. 
// AdminLayout is in layouts/AdminLayout.tsx (depth 2). 
// pages/admin/AdminNotices.tsx (depth 3). So ../../components/ui/Button is correct.

export default function AdminNotices() {
  const [notices, setNotices] = useState([
     { id: 1, title: 'Annual General Meeting', date: '2024-10-24', urgency: 'HIGH', status: 'PUBLISHED' },
     { id: 2, title: 'Pool Maintenance', date: '2024-10-22', urgency: 'LOW', status: 'PUBLISHED' },
  ]);

  return (
    <div className="p-8">
       <div className="flex justify-between items-center mb-8">
           <h1 className="text-2xl font-bold text-gray-900">Notices Management</h1>
           <Button>
              <Plus size={18} className="mr-2" /> Create Notice
           </Button>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
           <table className="w-full text-left">
               <thead className="bg-gray-50 border-b border-gray-100">
                   <tr>
                       <th className="p-4 font-semibold text-gray-600 font-sm">Title</th>
                       <th className="p-4 font-semibold text-gray-600 font-sm">Date</th>
                       <th className="p-4 font-semibold text-gray-600 font-sm">Urgency</th>
                       <th className="p-4 font-semibold text-gray-600 font-sm">Status</th>
                       <th className="p-4 font-semibold text-gray-600 font-sm">Actions</th>
                   </tr>
               </thead>
               <tbody>
                   {notices.map((notice) => (
                       <tr key={notice.id} className="border-b border-gray-50 last:border-none hover:bg-gray-50">
                           <td className="p-4 font-medium text-gray-800">{notice.title}</td>
                           <td className="p-4 text-gray-600">{notice.date}</td>
                           <td className="p-4">
                               <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                                   notice.urgency === 'HIGH' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                               }`}>
                                   {notice.urgency}
                               </span>
                           </td>
                           <td className="p-4">
                                <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-50 text-green-600">
                                    {notice.status}
                                </span>
                           </td>
                           <td className="p-4 flex gap-2">
                               <button className="text-gray-400 hover:text-indigo-600"><Edit size={16} /></button>
                               <button className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
       </div>
    </div>
  );
}
