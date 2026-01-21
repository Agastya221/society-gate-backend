import { useState } from 'react';
import api from '../api';

function Login({ onLogin }) {
  const [loginType, setLoginType] = useState('admin'); // 'admin', 'resident', 'guard'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (loginType === 'guard') {
        // Guards login with phone number
        res = await api.post('/auth/guard-app/login', { phone, password });
      } else {
        // Admin, Resident, Super Admin login with email
        res = await api.post('/auth/resident-app/login', { email, password });
      }

      if (res.data.success) {
        localStorage.setItem('token', res.data.data.token);
        onLogin(res.data.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const loginTypes = [
    { id: 'admin', label: 'Admin / Super Admin', icon: 'shield' },
    { id: 'resident', label: 'Resident', icon: 'home' },
    { id: 'guard', label: 'Security Guard', icon: 'user' },
  ];

  const getBgColor = () => {
    switch (loginType) {
      case 'admin': return 'from-blue-600 to-indigo-700';
      case 'resident': return 'from-indigo-600 to-purple-700';
      case 'guard': return 'from-amber-500 to-orange-600';
      default: return 'from-blue-600 to-indigo-700';
    }
  };

  const getButtonColor = () => {
    switch (loginType) {
      case 'admin': return 'bg-blue-600 hover:bg-blue-700';
      case 'resident': return 'bg-indigo-600 hover:bg-indigo-700';
      case 'guard': return 'bg-amber-600 hover:bg-amber-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getBgColor()} flex items-center justify-center p-4`}>
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className={`w-16 h-16 ${getButtonColor().split(' ')[0]} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SocietyGate</h1>
          <p className="text-gray-500 mt-1">Smart Society Management</p>
        </div>

        {/* Login Type Tabs */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          {loginTypes.map(type => (
            <button
              key={type.id}
              onClick={() => { setLoginType(type.id); setError(''); }}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
                loginType === type.id
                  ? 'bg-white shadow text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {loginType === 'guard' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="9876543210"
                required
              />
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={loginType === 'admin' ? 'admin@example.com' : 'resident@example.com'}
                required
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full ${getButtonColor()} text-white py-3 rounded-lg font-medium transition disabled:opacity-50`}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <p className="font-medium text-gray-700 mb-2">Demo Accounts:</p>
          {loginType === 'admin' && (
            <>
              <p className="text-gray-600"><b>Super Admin:</b> admin@societygate.com / admin123</p>
              <p className="text-gray-600"><b>Admin:</b> rajesh@greenvalley.com / admin123</p>
            </>
          )}
          {loginType === 'resident' && (
            <>
              <p className="text-gray-600"><b>Resident:</b> Create via Admin panel</p>
              <p className="text-gray-500 text-xs mt-1">Or use admin@societygate.com to test</p>
            </>
          )}
          {loginType === 'guard' && (
            <>
              <p className="text-gray-600"><b>Guard:</b> Create via Admin panel</p>
              <p className="text-gray-500 text-xs mt-1">Guard accounts are created by society admin</p>
            </>
          )}
        </div>

        {/* Registration Link for Residents */}
        {loginType === 'resident' && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              New resident?{' '}
              <button
                onClick={() => alert('Registration flow would go here')}
                className="text-indigo-600 font-medium hover:underline"
              >
                Register here
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
