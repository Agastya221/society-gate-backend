import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Scan, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { guardAPI } from '../../api/guard';

// Mock Scanner Component since we can't easily use camera in web without https/permission
function ScannerMock({ onScan }: { onScan: (data: string) => void }) {
    const [input, setInput] = useState('');

    const handleSimulate = (e: React.FormEvent) => {
        e.preventDefault();
        if(input) {
            onScan(input);
            setInput('');
        }
    }

    return (
        <div className="bg-black/90 fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
            <div className="w-64 h-64 border-2 border-emerald-500 rounded-2xl relative mb-8 flex items-center justify-center">
                 <div className="absolute inset-0 bg-emerald-500/10 animate-pulse"></div>
                 <Scan size={48} className="text-emerald-500/50" />
            </div>
            
            <form onSubmit={handleSimulate} className="w-full max-w-xs space-y-4">
                <p className="text-white text-center text-sm mb-4">Simulate QR Scan (Enter Token)</p>
                <input 
                    type="text" 
                    placeholder="Enter QR Token" 
                    className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-700"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold">
                    Simulate Scan
                </button>
            </form>
        </div>
    )
}

export default function QRScanner() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const scanMutation = useMutation({
    mutationFn: async (token: string) => {
        // Try pre-approval first, then gate pass
        try {
            return await guardAPI.scanPreApproval(token);
        } catch (e) {
            return await guardAPI.scanGatePass(token);
        }
    },
    onSuccess: (res: any) => {
        setResult(res.data);
        setScanning(false);
        toast.success('Valid QR Code Scanned');
    },
    onError: () => {
        toast.error('Invalid or Expired QR Code');
        setScanning(true); // Keep scanning
    }
  });

  return (
    <div className="p-4 h-full flex flex-col items-center justify-center min-h-[80vh]">
        {!result ? (
            <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Scan size={48} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Scan QR Code</h1>
                <p className="text-slate-400 max-w-xs mx-auto">
                    Scan visitor's pre-approval or gate pass QR code to verify entry.
                </p>
                <button 
                    onClick={() => setScanning(true)}
                    className="bg-emerald-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-900/20 hover:scale-105 transition"
                >
                    Start Scanner
                </button>
            </div>
        ) : (
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in duration-300">
                <button 
                    onClick={() => setResult(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={20} />
                </button>
                
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                         <Scan size={32} className="text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-green-700">Access Granted</h2>
                    <p className="text-sm text-gray-500">Code Verified Successfully</p>
                </div>

                <div className="space-y-4 border-t pt-4">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Visitor Name</span>
                        <span className="font-semibold">{result?.visitorName}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="font-semibold">{result?.visitorType || result?.type}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-gray-500">Valid Until</span>
                        <span className="font-semibold">{result?.validUntil ? new Date(result.validUntil).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
                
                <button 
                  onClick={() => setResult(null)} 
                  className="w-full mt-6 bg-slate-900 text-white py-3 rounded-xl font-semibold"
                >
                    Scan Next
                </button>
            </div>
        )}

        {scanning && (
            <div className="fixed inset-0 z-50">
                <button 
                    onClick={() => setScanning(false)}
                    className="absolute top-4 right-4 z-50 bg-black/50 text-white p-2 rounded-full"
                >
                    <X size={24} />
                </button>
                <ScannerMock onScan={(token) => scanMutation.mutate(token)} />
            </div>
        )}
    </div>
  );
}
