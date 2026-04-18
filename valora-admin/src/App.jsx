import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import AdminAuth from './pages/AdminAuth';
import AdminRegister from './pages/AdminRegister';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Rules from './pages/Rules';
import Reports from './pages/Reports';
import AppShell from "./components/layout/AppShell";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const handleLogout = () => {
    sessionStorage.removeItem("valoraAdminToken");
    navigate("/login");
  };

  return (
    <AppShell onLogout={handleLogout}>{children}</AppShell>
  );
};

// Protected routes wrapper
const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem("valoraAdminToken");
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminAuth />} />
        <Route path="/register" element={<AdminRegister />} />
        
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
        <Route path="/rules" element={<ProtectedRoute><Rules /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
