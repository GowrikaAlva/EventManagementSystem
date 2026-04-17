import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import AdminAuth from './pages/AdminAuth';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Rules from './pages/Rules';

// Simple Layout wrapper
const Layout = ({ children }) => {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("valoraAdminToken");
    navigate("/login");
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ width: '250px', background: '#1a1a1a', color: '#fff', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '30px', color: '#f56565' }}>Valora Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '15px', flexGrow: 1 }}>
          <Link to="/" style={{ color: '#ccc', textDecoration: 'none' }}>Dashboard</Link>
          <Link to="/employees" style={{ color: '#ccc', textDecoration: 'none' }}>Employees</Link>
          <Link to="/rules" style={{ color: '#ccc', textDecoration: 'none' }}>Rules</Link>
        </nav>
        <button onClick={handleLogout} style={{ padding: '10px', background: 'transparent', color: '#fff', border: '1px solid #4a5568', cursor: 'pointer' }}>Logout</button>
      </div>
      <div style={{ flexGrow: 1, padding: '30px', background: '#f7fafc', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

// Protected routes wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("valoraAdminToken");
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminAuth />} />
        
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/rules" element={<ProtectedRoute><Rules /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
