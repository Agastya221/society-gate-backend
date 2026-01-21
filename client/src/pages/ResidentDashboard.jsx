import { useState, useEffect } from 'react';
import api from '../api';

const extractArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const possibleKeys = [key, 'items', 'results', 'list'];
    for (const k of possibleKeys) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
};

function ResidentDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Home' },
    { id: 'preapprovals', label: 'Pre-Approvals' },
    { id: 'gatepasses', label: 'Gate Passes' },
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'staff', label: 'My Staff' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'complaints', label: 'Complaints' },
    { id: 'notices', label: 'Notices' },
    { id: 'emergency', label: 'Emergency' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-lg fixed h-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SG</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">SocietyGate</h1>
              <p className="text-xs text-gray-500">Resident App</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-b bg-indigo-50">
          <p className="text-sm font-medium text-indigo-800">{user.society?.name || 'Society'}</p>
          <p className="text-xs text-indigo-600">Flat {user.flat?.flatNumber || 'N/A'}</p>
        </div>
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg mb-1 font-medium ${activeMenu === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-indigo-600 font-medium">{user.name?.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">{user.phone}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full text-left text-red-600 text-sm p-2 rounded hover:bg-red-50">Logout</button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        {activeMenu === 'dashboard' && <DashboardView user={user} />}
        {activeMenu === 'preapprovals' && <PreApprovalsView />}
        {activeMenu === 'gatepasses' && <GatePassesView />}
        {activeMenu === 'deliveries' && <DeliveriesView />}
        {activeMenu === 'staff' && <MyStaffView />}
        {activeMenu === 'amenities' && <AmenitiesView />}
        {activeMenu === 'complaints' && <ComplaintsView />}
        {activeMenu === 'notices' && <NoticesView />}
        {activeMenu === 'emergency' && <EmergencyView />}
      </main>
    </div>
  );
}

function DashboardView({ user }) {
  const [recentEntries, setRecentEntries] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entriesRes, noticesRes] = await Promise.all([
        api.get('/entries?limit=5'),
        api.get('/notices?limit=3')
      ]);
      setRecentEntries(extractArray(entriesRes.data.data, 'entries').slice(0, 5));
      setNotices(extractArray(noticesRes.data.data, 'notices').slice(0, 3));
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Welcome, {user.name}!</h1>
      <p className="text-gray-500 mb-6">Flat {user.flat?.flatNumber} | {user.society?.name}</p>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <QuickAction label="Pre-Approve Guest" color="indigo" />
        <QuickAction label="Request Gate Pass" color="green" />
        <QuickAction label="Book Amenity" color="purple" />
        <QuickAction label="Report Issue" color="red" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Visitors</h2>
          {recentEntries.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent visitors</p>
          ) : (
            <div className="space-y-3">
              {recentEntries.map(e => (
                <div key={e.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{e.visitorName}</p>
                    <p className="text-xs text-gray-500">{e.type}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Latest Notices</h2>
          {notices.length === 0 ? (
            <p className="text-gray-500 text-sm">No notices</p>
          ) : (
            <div className="space-y-3">
              {notices.map(n => (
                <div key={n.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{n.content?.substring(0, 80)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label, color }) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
    green: 'bg-green-100 text-green-700 hover:bg-green-200',
    purple: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    red: 'bg-red-100 text-red-700 hover:bg-red-200',
  };
  return (
    <button className={`p-4 rounded-xl font-medium transition ${colors[color]}`}>
      {label}
    </button>
  );
}

function PreApprovalsView() {
  const [preapprovals, setPreapprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchPreapprovals(); }, []);

  const fetchPreapprovals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/preapprovals');
      setPreapprovals(extractArray(res.data.data, 'preapprovals'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pre-Approvals</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + Create Pre-Approval
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Visitor</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Valid Until</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {preapprovals.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No pre-approvals found</td></tr>
              ) : preapprovals.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{p.visitorName}</p>
                    <p className="text-sm text-gray-500">{p.visitorPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">{p.type}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{new Date(p.validUntil).toLocaleDateString()}</td>
                  <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <PreApprovalModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchPreapprovals(); }} />}
    </div>
  );
}

function PreApprovalModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ visitorName: '', visitorPhone: '', type: 'GUEST', validUntil: '', purpose: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/preapprovals', form);
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Create Pre-Approval</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Visitor Name" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, visitorName: e.target.value})} />
          <input placeholder="Phone Number" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, visitorPhone: e.target.value})} />
          <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, type: e.target.value})}>
            <option value="GUEST">Guest</option>
            <option value="DELIVERY">Delivery</option>
            <option value="CAB">Cab</option>
            <option value="SERVICE">Service</option>
          </select>
          <input type="datetime-local" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, validUntil: e.target.value})} />
          <input placeholder="Purpose" className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, purpose: e.target.value})} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GatePassesView() {
  const [gatepasses, setGatepasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchGatepasses(); }, []);

  const fetchGatepasses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/gatepasses');
      setGatepasses(extractArray(res.data.data, 'gatepasses'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gate Passes</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + Request Gate Pass
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {loading ? <p className="col-span-3 text-center py-8 text-gray-500">Loading...</p> :
          gatepasses.length === 0 ? <p className="col-span-3 text-center py-8 text-gray-500">No gate passes found</p> :
          gatepasses.map(g => (
            <div key={g.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{g.type}</span>
                <StatusBadge status={g.status} />
              </div>
              <p className="font-medium">{g.purpose}</p>
              <p className="text-sm text-gray-500 mt-2">Valid: {new Date(g.validFrom).toLocaleDateString()} - {new Date(g.validUntil).toLocaleDateString()}</p>
              {g.vehicleNumber && <p className="text-sm text-gray-500">Vehicle: {g.vehicleNumber}</p>}
            </div>
          ))
        }
      </div>

      {showModal && <GatePassModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchGatepasses(); }} />}
    </div>
  );
}

function GatePassModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ type: 'MATERIAL_IN', purpose: '', validFrom: '', validUntil: '', vehicleNumber: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log(form);
    try {
      await api.post('/gatepasses', form);
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Request Gate Pass</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, type: e.target.value})}>
            <option value="MATERIAL_IN">Material In</option>
            <option value="MATERIAL_OUT">Material Out</option>
            <option value="VEHICLE">Vehicle</option>
            <option value="VISITOR">Visitor</option>
          </select>
          <input placeholder="Purpose" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, purpose: e.target.value})} />
          <input type="datetime-local" required className="w-full px-4 py-2 border rounded-lg" placeholder="Valid From" onChange={e => setForm({...form, validFrom: e.target.value})} />
          <input type="datetime-local" required className="w-full px-4 py-2 border rounded-lg" placeholder="Valid Until" onChange={e => setForm({...form, validUntil: e.target.value})} />
          <input placeholder="Vehicle Number (optional)" className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, vehicleNumber: e.target.value})} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Requesting...' : 'Request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeliveriesView() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDeliveries(); }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries');
      setDeliveries(extractArray(res.data.data, 'deliveries'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/deliveries/${id}/${action}`);
      fetchDeliveries();
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Deliveries</h1>
        <button onClick={fetchDeliveries} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {loading ? <p className="col-span-2 text-center py-8 text-gray-500">Loading...</p> :
          deliveries.length === 0 ? <p className="col-span-2 text-center py-8 text-gray-500">No deliveries</p> :
          deliveries.map(d => (
            <div key={d.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">{d.type}</span>
                <StatusBadge status={d.status} />
              </div>
              <p className="font-medium">{d.companyName || 'Unknown'}</p>
              <p className="text-sm text-gray-500">AWB: {d.awbNumber || 'N/A'}</p>
              <p className="text-sm text-gray-500">{new Date(d.createdAt).toLocaleString()}</p>
              {d.status === 'PENDING' && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleAction(d.id, 'accept')} className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm">Accept</button>
                  <button onClick={() => handleAction(d.id, 'reject')} className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm">Reject</button>
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}

function MyStaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/domestic-staff');
      setStaff(extractArray(res.data.data, 'staff'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Domestic Staff</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + Add Staff
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {loading ? <p className="col-span-3 text-center py-8 text-gray-500">Loading...</p> :
          staff.length === 0 ? <p className="col-span-3 text-center py-8 text-gray-500">No staff registered</p> :
          staff.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xl font-medium text-gray-600">{s.name?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-gray-500">{s.phone}</p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{s.staffType}</span>
                <span className={`px-3 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))
        }
      </div>

      {showModal && <AddStaffModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchStaff(); }} />}
    </div>
  );
}

function AddStaffModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', phone: '', staffType: 'MAID', aadhaarNumber: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/domestic-staff', form);
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Add Domestic Staff</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Name" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, name: e.target.value})} />
          <input placeholder="Phone" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, phone: e.target.value})} />
          <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, staffType: e.target.value})}>
            <option value="MAID">Maid</option>
            <option value="COOK">Cook</option>
            <option value="DRIVER">Driver</option>
            <option value="NANNY">Nanny</option>
            <option value="GARDENER">Gardener</option>
            <option value="OTHER">Other</option>
          </select>
          <input placeholder="Aadhaar Number" className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, aadhaarNumber: e.target.value})} />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Adding...' : 'Add Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AmenitiesView() {
  const [amenities, setAmenities] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAmenity, setSelectedAmenity] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [amenitiesRes, bookingsRes] = await Promise.all([
        api.get('/amenities/amenities'),
        api.get('/amenities/bookings')
      ]);
      setAmenities(extractArray(amenitiesRes.data.data, 'amenities'));
      setBookings(extractArray(bookingsRes.data.data, 'bookings'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Amenities</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {loading ? <p className="col-span-3 text-center py-8 text-gray-500">Loading...</p> :
          amenities.map(a => (
            <div key={a.id} className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">{a.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{a.description}</p>
              <div className="text-sm space-y-1 mb-4">
                <p><span className="text-gray-500">Capacity:</span> {a.capacity}</p>
                <p><span className="text-gray-500">Price:</span> Rs. {a.pricePerHour}/hr</p>
              </div>
              <button
                onClick={() => { setSelectedAmenity(a); setShowModal(true); }}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Book Now
              </button>
            </div>
          ))
        }
      </div>

      <h2 className="text-xl font-bold mb-4">My Bookings</h2>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Amenity</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Date</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Time</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No bookings</td></tr>
            ) : bookings.map(b => (
              <tr key={b.id} className="border-t">
                <td className="px-6 py-4 font-medium">{b.amenity?.name}</td>
                <td className="px-6 py-4">{new Date(b.startTime).toLocaleDateString()}</td>
                <td className="px-6 py-4">{new Date(b.startTime).toLocaleTimeString()} - {new Date(b.endTime).toLocaleTimeString()}</td>
                <td className="px-6 py-4"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedAmenity && (
        <BookAmenityModal
          amenity={selectedAmenity}
          onClose={() => { setShowModal(false); setSelectedAmenity(null); }}
          onSuccess={() => { setShowModal(false); setSelectedAmenity(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function BookAmenityModal({ amenity, onClose, onSuccess }) {
  const [form, setForm] = useState({ startTime: '', endTime: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/amenities/bookings', { amenityId: amenity.id, ...form });
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Book {amenity.name}</h2>
        <p className="text-gray-500 mb-4">Rs. {amenity.pricePerHour}/hour</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input type="datetime-local" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, startTime: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input type="datetime-local" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, endTime: e.target.value})} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Booking...' : 'Book'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchComplaints(); }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/complaints');
      setComplaints(extractArray(res.data.data, 'complaints'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Complaints</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          + New Complaint
        </button>
      </div>

      <div className="space-y-4">
        {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> :
          complaints.length === 0 ? <p className="text-center py-8 text-gray-500">No complaints</p> :
          complaints.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{c.title}</h3>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    c.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                    c.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                  }`}>{c.priority}</span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">{c.description}</p>
              <p className="text-xs text-gray-400">Filed: {new Date(c.createdAt).toLocaleDateString()}</p>
            </div>
          ))
        }
      </div>

      {showModal && <ComplaintModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); fetchComplaints(); }} />}
    </div>
  );
}

function ComplaintModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'MAINTENANCE', priority: 'MEDIUM' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/complaints', form);
      onSuccess();
    } catch (err) { setError(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">New Complaint</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Title" required className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, title: e.target.value})} />
          <textarea placeholder="Description" required rows={3} className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, description: e.target.value})} />
          <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, category: e.target.value})}>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="SECURITY">Security</option>
            <option value="CLEANLINESS">Cleanliness</option>
            <option value="NOISE">Noise</option>
            <option value="PARKING">Parking</option>
            <option value="OTHER">Other</option>
          </select>
          <select className="w-full px-4 py-2 border rounded-lg" onChange={e => setForm({...form, priority: e.target.value})}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoticesView() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notices');
      setNotices(extractArray(res.data.data, 'notices'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Society Notices</h1>
      <div className="space-y-4">
        {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> :
          notices.length === 0 ? <p className="text-center py-8 text-gray-500">No notices</p> :
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{n.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  n.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                  n.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                }`}>{n.priority}</span>
              </div>
              <p className="text-gray-600 mb-3">{n.content}</p>
              <p className="text-xs text-gray-400">Posted: {new Date(n.createdAt).toLocaleDateString()}</p>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function EmergencyView() {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEmergencies(); }, []);

  const fetchEmergencies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/emergencies/my');
      setEmergencies(extractArray(res.data.data, 'emergencies'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const triggerEmergency = async (type) => {
    try {
      await api.post('/emergencies', { type, description: `${type} emergency triggered` });
      fetchEmergencies();
      alert('Emergency alert sent!');
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Emergency</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <button onClick={() => triggerEmergency('FIRE')} className="p-8 bg-red-100 rounded-xl text-center hover:bg-red-200">
          <div className="text-4xl mb-2">🔥</div>
          <p className="font-bold text-red-700">Fire</p>
        </button>
        <button onClick={() => triggerEmergency('MEDICAL')} className="p-8 bg-blue-100 rounded-xl text-center hover:bg-blue-200">
          <div className="text-4xl mb-2">🏥</div>
          <p className="font-bold text-blue-700">Medical</p>
        </button>
        <button onClick={() => triggerEmergency('SECURITY')} className="p-8 bg-yellow-100 rounded-xl text-center hover:bg-yellow-200">
          <div className="text-4xl mb-2">🚨</div>
          <p className="font-bold text-yellow-700">Security</p>
        </button>
      </div>

      <h2 className="text-xl font-bold mb-4">Recent Emergency Alerts</h2>
      <div className="space-y-4">
        {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> :
          emergencies.length === 0 ? <p className="text-center py-8 text-gray-500">No emergencies</p> :
          emergencies.map(e => (
            <div key={e.id} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
              <div>
                <span className="font-medium">{e.type}</span>
                <p className="text-sm text-gray-500">{e.description}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={e.status} />
                <p className="text-xs text-gray-400 mt-1">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    ACTIVE: 'bg-green-100 text-green-700',
    USED: 'bg-blue-100 text-blue-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
    REJECTED: 'bg-red-100 text-red-700',
    OPEN: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    CHECKED_IN: 'bg-blue-100 text-blue-700',
    CHECKED_OUT: 'bg-gray-100 text-gray-700',
    DELIVERED: 'bg-green-100 text-green-700',
    COLLECTED: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

export default ResidentDashboard;
