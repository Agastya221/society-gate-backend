import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import GuardDashboard from './pages/GuardDashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Render dashboard based on user role
  const renderDashboard = () => {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard user={user} onLogout={handleLogout} />;
      case 'ADMIN':
        return <AdminDashboard user={user} onLogout={handleLogout} />;
      case 'RESIDENT':
        return <ResidentDashboard user={user} onLogout={handleLogout} />;
      case 'GUARD':
        return <GuardDashboard user={user} onLogout={handleLogout} />;
      default:
        return <AdminDashboard user={user} onLogout={handleLogout} />;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/*"
          element={!user ? <Navigate to="/login" /> : renderDashboard()}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
