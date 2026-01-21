import { useState, useEffect } from 'react';
import api from '../api';

// Helper to extract array from API response (handles both array and object with nested array)
const extractArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    // Try common keys: notices, complaints, vendors, entries, staff, etc.
    const possibleKeys = [key, 'items', 'results', 'list'];
    for (const k of possibleKeys) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
};

function AdminDashboard({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeMenu === 'dashboard') {
      fetchDashboard();
    }
  }, [activeMenu]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/dashboard');
      setStats(res.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { id: 'entries', label: 'Entries', icon: 'users' },
    { id: 'staff', label: 'Domestic Staff', icon: 'briefcase' },
    { id: 'residents', label: 'Residents', icon: 'home' },
    { id: 'amenities', label: 'Amenities', icon: 'calendar' },
    { id: 'notices', label: 'Notices', icon: 'bell' },
    { id: 'complaints', label: 'Complaints', icon: 'alert' },
    { id: 'vendors', label: 'Vendors', icon: 'truck' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-white shadow-lg fixed h-full">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SG</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800">SocietyGate</h1>
              <p className="text-xs text-gray-500">Society Admin</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-b bg-green-50">
          <p className="text-sm font-medium text-green-800">{user.society?.name || 'Your Society'}</p>
          <p className="text-xs text-green-600">{user.flat?.flatNumber ? `Flat ${user.flat.flatNumber}` : 'Administrator'}</p>
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
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-medium">{user.name?.charAt(0)}</span>
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
        {activeMenu === 'dashboard' && <DashboardView stats={stats} loading={loading} />}
        {activeMenu === 'entries' && <EntriesView />}
        {activeMenu === 'staff' && <StaffView />}
        {activeMenu === 'residents' && <ResidentsView />}
        {activeMenu === 'amenities' && <AmenitiesView />}
        {activeMenu === 'notices' && <NoticesView />}
        {activeMenu === 'complaints' && <ComplaintsView />}
        {activeMenu === 'vendors' && <VendorsView />}
      </main>
    </div>
  );
}

function NavItem({ label, isActive, onClick }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3 rounded-lg mb-1 font-medium ${isActive ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}>
      {label}
    </button>
  );
}

function DashboardView({ stats, loading }) {
  if (loading) return <div className="text-center py-8 text-gray-500">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card title="Today Entries" value={stats?.todayEntries || 0} color="blue" />
        <Card title="Pending Entries" value={stats?.pendingEntries || 0} color="yellow" />
        <Card title="Total Residents" value={stats?.totalResidents || 0} color="green" />
        <Card title="Total Guards" value={stats?.totalGuards || 0} color="purple" />
      </div>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card title="Total Flats" value={stats?.totalFlats || 0} color="indigo" />
        <Card title="Domestic Staff" value={stats?.totalDomesticStaff || 0} color="pink" />
        <Card title="Active Vendors" value={stats?.totalVendors || 0} color="orange" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction label="Add Entry" />
            <QuickAction label="Create Notice" />
            <QuickAction label="Add Staff" />
            <QuickAction label="New Vendor" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <ActivityItem text="New visitor entry recorded" time="2 mins ago" />
            <ActivityItem text="Complaint #123 resolved" time="15 mins ago" />
            <ActivityItem text="Amenity booking confirmed" time="1 hour ago" />
            <ActivityItem text="New resident registered" time="2 hours ago" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ label }) {
  return (
    <button className="p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition">
      {label}
    </button>
  );
}

function ActivityItem({ text, time }) {
  return (
    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
      <span className="text-sm text-gray-700">{text}</span>
      <span className="text-xs text-gray-400">{time}</span>
    </div>
  );
}

function Card({ title, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]?.split(' ')[1] || 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function EntriesView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchEntries(); }, [filter]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'pending' ? '/entries/pending' : filter === 'today' ? '/entries/today' : '/entries';
      const res = await api.get(endpoint);
      setEntries(extractArray(res.data.data, 'entries'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Visitor Entries</h1>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="px-4 py-2 bg-white border rounded-lg">
            <option value="all">All Entries</option>
            <option value="today">Today</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={fetchEntries} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Visitor</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Flat</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No entries found</td></tr>
              ) : entries.map(e => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{e.visitorName}</p>
                    <p className="text-sm text-gray-500">{e.visitorPhone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{e.type}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{e.flat?.flatNumber || '-'}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-2xl font-bold">Domestic Staff</h1>
        <button onClick={fetchStaff} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Verified</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No staff found</td></tr>
              ) : staff.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{s.name}</td>
                  <td className="px-6 py-4 text-gray-600">{s.phone}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">{s.staffType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <BoolBadge value={s.isVerified} trueLabel="Verified" falseLabel="Unverified" />
                  </td>
                  <td className="px-6 py-4">
                    <BoolBadge value={s.isActive} trueLabel="Active" falseLabel="Inactive" />
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

function ResidentsView() {
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchResidents(); }, []);

  const fetchResidents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/resident-app/guards');
      setResidents(extractArray(res.data.data, 'residents'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Residents</h1>
        <button onClick={fetchResidents} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Email</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Phone</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Flat</th>
              </tr>
            </thead>
            <tbody>
              {residents.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No residents found</td></tr>
              ) : residents.map(r => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{r.name}</td>
                  <td className="px-6 py-4 text-gray-600">{r.email}</td>
                  <td className="px-6 py-4 text-gray-600">{r.phone}</td>
                  <td className="px-6 py-4">{r.flat?.flatNumber || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AmenitiesView() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAmenities(); }, []);

  const fetchAmenities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/amenities/amenities');
      setAmenities(extractArray(res.data.data, 'amenities'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Amenities</h1>
        <button onClick={fetchAmenities} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {loading ? <p className="col-span-3 text-center py-8 text-gray-500">Loading...</p> :
          amenities.length === 0 ? <p className="col-span-3 text-center py-8 text-gray-500">No amenities found</p> :
          amenities.map(a => (
            <div key={a.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg">{a.name}</h3>
                <BoolBadge value={a.isActive} trueLabel="Active" falseLabel="Inactive" />
              </div>
              <p className="text-sm text-gray-500 mb-3">{a.description || 'No description'}</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">Type:</span> <span className="font-medium">{a.type}</span></p>
                <p><span className="text-gray-500">Capacity:</span> <span className="font-medium">{a.capacity} people</span></p>
                <p><span className="text-gray-500">Price:</span> <span className="font-medium">Rs. {a.pricePerHour}/hr</span></p>
              </div>
            </div>
          ))
        }
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

  const priorityColors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notices</h1>
        <button onClick={fetchNotices} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="space-y-4">
        {loading ? <p className="text-center py-8 text-gray-500">Loading...</p> :
          notices.length === 0 ? <p className="text-center py-8 text-gray-500">No notices found</p> :
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{n.title}</h3>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs ${priorityColors[n.priority] || priorityColors.MEDIUM}`}>
                    {n.priority}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{n.type}</span>
                </div>
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

function ComplaintsView() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-2xl font-bold">Complaints</h1>
        <button onClick={fetchComplaints} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Title</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Category</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Priority</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {complaints.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No complaints found</td></tr>
              ) : complaints.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{c.description}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{c.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function VendorsView() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vendors');
      setVendors(extractArray(res.data.data, 'vendors'));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <button onClick={fetchVendors} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Refresh</button>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {loading ? <p className="col-span-3 text-center py-8 text-gray-500">Loading...</p> :
          vendors.length === 0 ? <p className="col-span-3 text-center py-8 text-gray-500">No vendors found</p> :
          vendors.map(v => (
            <div key={v.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-lg">{v.name}</h3>
                <BoolBadge value={v.isVerified} trueLabel="Verified" falseLabel="Unverified" />
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Category:</span> <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{v.category}</span></p>
                <p><span className="text-gray-500">Phone:</span> <span className="font-medium">{v.phone}</span></p>
                <p><span className="text-gray-500">Address:</span> <span className="text-gray-600">{v.address || 'N/A'}</span></p>
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
    CHECKED_IN: 'bg-blue-100 text-blue-700',
    CHECKED_OUT: 'bg-gray-100 text-gray-700',
    REJECTED: 'bg-red-100 text-red-700',
    OPEN: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const colors = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${colors[priority] || colors.MEDIUM}`}>
      {priority}
    </span>
  );
}

function BoolBadge({ value, trueLabel, falseLabel }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export default AdminDashboard;
