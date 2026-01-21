import { useState, useEffect } from 'react';
import api from '../api';

function SuperAdminDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchSocieties(); }, []);

  const fetchSocieties = async () => {
    setLoading(true);
    try {
      const res = await api.get('/societies');
      // API returns { societies, pagination } so we need to access .societies
      const data = res.data.data;
      setSocieties(Array.isArray(data) ? data : (data?.societies || []));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-lg fixed h-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SG</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">SocietyGate</h1>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>
        </div>
        <nav className="p-4">
          <NavItem label="Dashboard" isActive={activeMenu === 'dashboard'} onClick={() => setActiveMenu('dashboard')} />
          <NavItem label="Societies" isActive={activeMenu === 'societies'} onClick={() => setActiveMenu('societies')} />
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">{user.name?.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full text-left text-red-600 text-sm p-2 rounded hover:bg-red-50">Logout</button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        {activeMenu === 'dashboard' && <Dashboard societies={societies} />}
        {activeMenu === 'societies' && <Societies societies={societies} loading={loading} onRefresh={fetchSocieties} onAdd={() => setShowModal(true)} />}
      </main>

      {showModal && <AddSocietyModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchSocieties(); }} />}
    </div>
  );
}

function NavItem({ label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-lg mb-1 font-medium ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

function Dashboard({ societies }) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card title="Total Societies" value={societies.length} />
        <Card title="Active" value={societies.filter(s => s.isActive).length} />
        <Card title="Total Flats" value={societies.reduce((a, s) => a + (s.totalFlats || 0), 0)} />
        <Card title="Pending Payment" value={societies.filter(s => s.paymentStatus === 'PENDING').length} />
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Societies</h2>
        {societies.slice(0, 5).map(s => (
          <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">{s.city}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {s.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Societies({ societies, loading, onRefresh, onAdd }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Societies</h1>
        <div className="flex gap-3">
          <button onClick={onRefresh} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
          <button onClick={onAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Society</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Location</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Flats</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Contact</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {societies.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.name}</td>
                  <td className="px-6 py-4 text-gray-600">{s.city}, {s.state}</td>
                  <td className="px-6 py-4">{s.totalFlats}</td>
                  <td className="px-6 py-4 text-gray-600">{s.contactPhone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AddSocietyModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', pincode: '', contactName: '', contactPhone: '', contactEmail: '', totalFlats: 0, monthlyFee: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/societies', form);
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">Add Society</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input placeholder="Society Name" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('name', e.target.value)} />
          <input placeholder="Address" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('address', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="City" required className="px-4 py-2 border rounded-lg" onChange={e => update('city', e.target.value)} />
            <input placeholder="State" required className="px-4 py-2 border rounded-lg" onChange={e => update('state', e.target.value)} />
          </div>
          <input placeholder="Pincode" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('pincode', e.target.value)} />
          <input placeholder="Contact Name" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('contactName', e.target.value)} />
          <input placeholder="Contact Phone" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('contactPhone', e.target.value)} />
          <input placeholder="Contact Email" type="email" required className="w-full px-4 py-2 border rounded-lg" onChange={e => update('contactEmail', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Total Flats" type="number" required className="px-4 py-2 border rounded-lg" onChange={e => update('totalFlats', parseInt(e.target.value))} />
            <input placeholder="Monthly Fee" type="number" required className="px-4 py-2 border rounded-lg" onChange={e => update('monthlyFee', parseInt(e.target.value))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
