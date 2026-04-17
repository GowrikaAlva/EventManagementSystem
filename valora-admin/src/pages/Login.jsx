import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/admin-login', { email, password });
      if (res.data.success && res.data.token) {
        localStorage.setItem('valoraAdminToken', res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
      <form onSubmit={handleLogin} style={{ background: '#2d3748', padding: '40px', borderRadius: '8px', width: '350px', color: '#fff' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Valora Admin Login</h2>
        {error && <div style={{ color: '#fc8181', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#cbd5e0' }}>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#1a202c', color: '#fff' }} 
            required 
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: '#cbd5e0' }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #4a5568', background: '#1a202c', color: '#fff' }} 
            required 
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: '12px', background: '#48bb78', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          Login
        </button>
      </form>
    </div>
  );
};

export default Login;
