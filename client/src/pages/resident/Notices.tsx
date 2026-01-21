import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { FileText, Download } from 'lucide-react';

export default function Notices() {
  const notices = [
    { title: 'Annual General Meeting', date: 'Oct 24, 2024', summary: 'The AGM will be held on Oct 30th at the Clubhouse. Attendance is mandatory for all owners.', urgency: 'HIGH' },
    { title: 'Swimming Pool Maintenance', date: 'Oct 22, 2024', summary: 'The pool will be closed for cleaning every Monday.', urgency: 'LOW' },
    { title: 'Garbage Collection Timing', date: 'Oct 15, 2024', summary: 'Revised timings for wet and dry waste collection.', urgency: 'MEDIUM' },
  ];

  const colors: Record<string, string> = {
      HIGH: 'bg-red-50 text-red-600 border-red-200',
      MEDIUM: 'bg-orange-50 text-orange-600 border-orange-200',
      LOW: 'bg-blue-50 text-blue-600 border-blue-200'
  };

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notice Board</h1>

      <div className="space-y-4">
         {notices.map((notice, i) => (
             <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
             >
                <Card className="p-5" hoverEffect>
                    <div className="flex justify-between items-start mb-3">
                         <span className={`text-[10px] font-bold px-2 py-1 rounded border ${colors[notice.urgency]}`}>
                             {notice.urgency} PRIORITY
                         </span>
                         <span className="text-xs text-gray-400">{notice.date}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">{notice.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">{notice.summary}</p>
                    
                    <button className="flex items-center text-indigo-600 text-xs font-semibold hover:underline">
                        <FileText size={14} className="mr-1" /> Read Full Notice
                    </button>
                </Card>
             </motion.div>
         ))}
      </div>
    </div>
  );
}
