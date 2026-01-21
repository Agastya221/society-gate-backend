import { motion } from 'framer-motion';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CreditCard, History, ChevronRight } from 'lucide-react';

export default function Payments() {
  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payments</h1>

      {/* Due Amount */}
      <Card className="p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white mb-8 border-none shadow-indigo-200">
           <p className="text-indigo-200 text-sm font-medium mb-1">Maintenance Due</p>
           <h2 className="text-4xl font-bold mb-6">₹ 3,500</h2>
           
           <div className="flex space-x-3">
                <Button variant="secondary" className="flex-1 bg-white text-indigo-600 hover:bg-gray-50 shadow-none">
                    Pay Now
                </Button>
                <button className="p-3 bg-indigo-500/30 rounded-xl backdrop-blur-md">
                    <History size={20} />
                </button>
           </div>
      </Card>

      <h3 className="font-bold text-gray-800 mb-4">Payment History</h3>
      <div className="space-y-4">
           {[...Array(5)].map((_, i) => (
               <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                   <div className="flex items-center justify-between p-3 bg-white border-b border-gray-100 last:border-0">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-500">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">Monthly Maintenance</p>
                                <p className="text-xs text-gray-500">Sept 2024</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="font-bold text-gray-900">- ₹ 3,500</p>
                             <p className="text-[10px] text-green-600 font-medium">SUCCESS</p>
                        </div>
                   </div>
               </motion.div>
           ))}
      </div>
    </div>
  );
}
