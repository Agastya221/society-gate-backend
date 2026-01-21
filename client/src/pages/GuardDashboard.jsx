import { useState, useEffect } from 'react';
import api from '../api';

// Helper to extract array from API response
const extractArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const possibleKeys = [key, 'items', 'results', 'list', 'entries'];
    for (const k of possibleKeys) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
};

function GuardDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'entries', label: 'Entry Management' },
    { id: 'scan', label: 'Scan QR' },
    { id: 'staff', label: 'Staff Check-in' },
    { id: 'emergencies', label: 'Emergencies' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-lg fixed h-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SG</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">SocietyGate</h1>
              <p className="text-xs text-gray-500">Security Guard</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-b bg-amber-50">
          <p className="text-sm font-medium text-amber-800">{user.society?.name || 'Your Society'}</p>
          <p className="text-xs text-amber-600">{user.gatePoint?.name || 'Main Gate'}</p>
        </div>
        <nav className="p-4">
          {menuItems.map(item => (
            <NavItem
              key={item.id}
              label={item.label}
              isActive={activeMenu === item.id}
              onClick={() => setActiveMenu(item.id)}
            />
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 font-medium">{user.name?.charAt(0)}</span>
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
        {activeMenu === 'entries' && <EntriesView user={user} />}
        {activeMenu === 'scan' && <ScanView user={user} />}
        {activeMenu === 'staff' && <StaffView user={user} />}
        {activeMenu === 'emergencies' && <EmergenciesView user={user} />}
      </main>
    </div>
  );
}

function NavItem({ label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-lg mb-1 font-medium ${isActive ? 'bg-amber-50 text-amber-600' : 'text-gray-600 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

// ============================================
// DASHBOARD VIEW
// ============================================
function DashboardView({ user }) {
  const [todayData, setTodayData] = useState({ entries: [], stats: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayEntries();
  }, []);

  const fetchTodayEntries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/entries/today');
      setTodayData(res.data.data || { entries: [], stats: {} });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = todayData.stats || {};

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Guard Dashboard</h1>
        <button onClick={fetchTodayEntries} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard title="Total Today" value={stats.total || 0} color="blue" />
            <StatCard title="Pending" value={stats.pending || 0} color="yellow" />
            <StatCard title="Approved" value={stats.approved || 0} color="green" />
            <StatCard title="Checked Out" value={stats.checkedOut || 0} color="gray" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard title="Visitors" value={stats.visitor || 0} color="purple" />
            <StatCard title="Deliveries" value={stats.delivery || 0} color="orange" />
            <StatCard title="Staff" value={stats.domesticStaff || 0} color="teal" />
          </div>

          {/* Recent Entries */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Today's Entries</h2>
            <div className="space-y-3">
              {todayData.entries.slice(0, 10).map(entry => (
                <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{entry.visitorName}</p>
                    <p className="text-sm text-gray-500">
                      {entry.type} • Flat {entry.flat?.flatNumber}
                    </p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
              ))}
              {todayData.entries.length === 0 && (
                <p className="text-gray-500 text-center py-4">No entries today</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-sm opacity-80">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    CHECKED_OUT: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

// ============================================
// ENTRIES VIEW (Create Entry & Manage)
// ============================================
function EntriesView({ user }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/entries/today');
      const data = res.data.data;
      setEntries(extractArray(data, 'entries'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCheckout = async (entryId) => {
    try {
      await api.patch(`/entries/${entryId}/checkout`);
      fetchEntries();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to checkout');
    }
  };

  const filteredEntries = entries.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'pending') return e.status === 'PENDING';
    if (filter === 'approved') return e.status === 'APPROVED';
    if (filter === 'checkedOut') return e.status === 'CHECKED_OUT';
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Entry Management</h1>
        <div className="flex gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Entries</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved (Inside)</option>
            <option value="checkedOut">Checked Out</option>
          </select>
          <button onClick={fetchEntries} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            + New Entry
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-gray-500">Loading...</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Visitor</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Flat</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Check-in</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{entry.visitorName}</p>
                    <p className="text-sm text-gray-500">{entry.visitorPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{entry.type}</span>
                  </td>
                  <td className="px-6 py-4">{entry.flat?.flatNumber || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(entry.checkInTime).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-6 py-4">
                    {entry.status === 'APPROVED' && !entry.checkOutTime && (
                      <button
                        onClick={() => handleCheckout(entry.id)}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        Check Out
                      </button>
                    )}
                    {entry.status === 'PENDING' && (
                      <span className="text-yellow-600 text-sm">Awaiting approval</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewEntryModal
          user={user}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchEntries(); }}
        />
      )}
    </div>
  );
}

function NewEntryModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    visitorName: '',
    visitorPhone: '',
    type: 'VISITOR',
    flatId: '',
    vehicleNumber: '',
    purpose: '',
    companyName: '',
  });
  const [flats, setFlats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFlats();
  }, []);

  const fetchFlats = async () => {
    try {
      // Try to get flats from residents endpoint or society
      const res = await api.get('/reports/flats');
      const data = res.data.data;
      setFlats(extractArray(data, 'flats'));
    } catch (err) {
      // If no flats endpoint, guard can manually enter flat info
      console.log('Could not fetch flats');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/entries', {
        ...form,
        societyId: user.societyId,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">New Entry</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Entry Type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="VISITOR">Visitor</option>
              <option value="DELIVERY">Delivery</option>
              <option value="CAB">Cab</option>
              <option value="SERVICE">Service</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Visitor Name *</label>
            <input
              value={form.visitorName}
              onChange={(e) => update('visitorName', e.target.value)}
              placeholder="Enter name"
              required
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input
              value={form.visitorPhone}
              onChange={(e) => update('visitorPhone', e.target.value)}
              placeholder="Enter phone"
              required
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          {form.type === 'DELIVERY' && (
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                value={form.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="Amazon, Swiggy, etc."
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Flat *</label>
            {flats.length > 0 ? (
              <select
                value={form.flatId}
                onChange={(e) => update('flatId', e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select Flat</option>
                {flats.map(flat => (
                  <option key={flat.id} value={flat.id}>
                    {flat.flatNumber} - {flat.block || 'Block A'}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={form.flatId}
                onChange={(e) => update('flatId', e.target.value)}
                placeholder="Enter Flat ID"
                required
                className="w-full px-4 py-2 border rounded-lg"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Number</label>
            <input
              value={form.vehicleNumber}
              onChange={(e) => update('vehicleNumber', e.target.value)}
              placeholder="MH 12 AB 1234"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Purpose</label>
            <input
              value={form.purpose}
              onChange={(e) => update('purpose', e.target.value)}
              placeholder="Purpose of visit"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// SCAN VIEW (QR Scanning)
// ============================================
function ScanView({ user }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('preapproval');

  const handleScan = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let res;
      if (scanType === 'preapproval') {
        res = await api.post('/preapprovals/scan', { code });
      } else if (scanType === 'gatepass') {
        res = await api.post('/gatepasses/scan', { code });
      } else if (scanType === 'staff') {
        res = await api.post('/domestic-staff/scan', { code });
      }
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Scan QR Code</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm max-w-lg">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Scan Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setScanType('preapproval')}
              className={`px-4 py-2 rounded-lg ${scanType === 'preapproval' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}
            >
              Pre-Approval
            </button>
            <button
              onClick={() => setScanType('gatepass')}
              className={`px-4 py-2 rounded-lg ${scanType === 'gatepass' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}
            >
              Gate Pass
            </button>
            <button
              onClick={() => setScanType('staff')}
              className={`px-4 py-2 rounded-lg ${scanType === 'staff' ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}
            >
              Staff QR
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Enter QR Code Value</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste or enter code here"
            className="w-full px-4 py-3 border rounded-lg text-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            In production, this would scan from camera
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={loading || !code.trim()}
          className="w-full px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Verify Code'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-600 text-2xl">✓</span>
              <span className="font-semibold text-green-700">Valid Code</span>
            </div>
            <div className="space-y-2 text-sm">
              {result.visitorName && <p><span className="text-gray-500">Visitor:</span> {result.visitorName}</p>}
              {result.name && <p><span className="text-gray-500">Name:</span> {result.name}</p>}
              {result.flat && <p><span className="text-gray-500">Flat:</span> {result.flat.flatNumber}</p>}
              {result.flatNumber && <p><span className="text-gray-500">Flat:</span> {result.flatNumber}</p>}
              {result.type && <p><span className="text-gray-500">Type:</span> {result.type}</p>}
              {result.purpose && <p><span className="text-gray-500">Purpose:</span> {result.purpose}</p>}
              {result.validUntil && (
                <p><span className="text-gray-500">Valid Until:</span> {new Date(result.validUntil).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// STAFF VIEW (Domestic Staff Check-in/out)
// ============================================
function StaffView({ user }) {
  const [staff, setStaff] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('checkin');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [staffRes, attendanceRes] = await Promise.all([
        api.get('/domestic-staff'),
        api.get('/domestic-staff/attendance/records'),
      ]);
      setStaff(extractArray(staffRes.data.data, 'staff'));
      setAttendance(extractArray(attendanceRes.data.data, 'records'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCheckIn = async (staffId) => {
    try {
      await api.post('/domestic-staff/check-in', { staffId });
      fetchData();
      alert('Check-in successful');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async (staffId) => {
    try {
      await api.post(`/domestic-staff/${staffId}/check-out`);
      fetchData();
      alert('Check-out successful');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to check out');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Domestic Staff</h1>
        <button onClick={fetchData} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('checkin')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'checkin' ? 'bg-amber-600 text-white' : 'bg-white'}`}
        >
          Staff List
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'attendance' ? 'bg-amber-600 text-white' : 'bg-white'}`}
        >
          Today's Attendance
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : activeTab === 'checkin' ? (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.name}</td>
                  <td className="px-6 py-4">{s.type}</td>
                  <td className="px-6 py-4 text-gray-600">{s.phone}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckIn(s.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Check In
                      </button>
                      <button
                        onClick={() => handleCheckOut(s.id)}
                        className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                      >
                        Check Out
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No staff registered</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Staff</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Check In</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Check Out</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Duration</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(a => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{a.staff?.name || a.staffName || '-'}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {a.checkInTime ? new Date(a.checkInTime).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {a.checkOutTime ? new Date(a.checkOutTime).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {a.checkInTime && a.checkOutTime
                      ? `${Math.round((new Date(a.checkOutTime) - new Date(a.checkInTime)) / 60000)} min`
                      : a.checkInTime ? 'Still inside' : '-'}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No attendance records today</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// EMERGENCIES VIEW
// ============================================
function EmergenciesView({ user }) {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    fetchEmergencies();
  }, [activeTab]);

  const fetchEmergencies = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'active' ? '/emergencies/active' : '/emergencies';
      const res = await api.get(endpoint);
      setEmergencies(extractArray(res.data.data, 'emergencies'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleRespond = async (id) => {
    try {
      await api.patch(`/emergencies/${id}/respond`);
      fetchEmergencies();
      alert('Marked as responding');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond');
    }
  };

  const typeColors = {
    FIRE: 'bg-red-100 text-red-700',
    MEDICAL: 'bg-pink-100 text-pink-700',
    SECURITY: 'bg-orange-100 text-orange-700',
    OTHER: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Emergencies</h1>
        <button onClick={fetchEmergencies} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'active' ? 'bg-red-600 text-white' : 'bg-white'}`}
        >
          Active Emergencies
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'all' ? 'bg-red-600 text-white' : 'bg-white'}`}
        >
          All History
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-4">
          {emergencies.map(e => (
            <div key={e.id} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${e.status === 'ACTIVE' ? 'border-red-500' : 'border-gray-300'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[e.type] || typeColors.OTHER}`}>
                      {e.type}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${e.status === 'ACTIVE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {e.status}
                    </span>
                  </div>
                  <p className="font-medium">{e.description || 'Emergency Alert'}</p>
                  <p className="text-sm text-gray-500">
                    Flat {e.flat?.flatNumber || '-'} • {new Date(e.createdAt).toLocaleString()}
                  </p>
                  {e.reportedBy && (
                    <p className="text-sm text-gray-500">Reported by: {e.reportedBy.name}</p>
                  )}
                </div>
                {e.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleRespond(e.id)}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    Respond
                  </button>
                )}
              </div>
            </div>
          ))}
          {emergencies.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center text-gray-500">
              {activeTab === 'active' ? 'No active emergencies' : 'No emergency records'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GuardDashboard;
