import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const Employees = () => {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if(res.data.success) setUsers(res.data.users);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/users', { email: newEmail, role: newRole });
      if(res.data.success) {
        setSuccess(`User ${newEmail} added successfully! Tell them to login via the Chrome extension.`);
        setNewEmail('');
        fetchUsers();
      }
    } catch(err) {
      setError(err.response?.data?.error || 'Failed to add user');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Manage Employees</h1>
      
      <div style={{ background: '#fff', borderRadius: '8px', padding: '25px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Add New User</h3>
        {error && <div style={{ color: '#e53e3e', marginBottom: '10px', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ color: '#38a169', marginBottom: '10px', fontSize: '14px' }}>{success}</div>}
        
        <form onSubmit={handleAddEmployee} style={{ display: 'flex', gap: '15px', alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#4a5568', marginBottom: '5px' }}>Email Address</label>
            <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '4px' }} placeholder="jane@company.com" />
          </div>
          <div style={{ width: '150px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#4a5568', marginBottom: '5px' }}>Role</label>
            <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '4px', background: '#fff' }}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" style={{ padding: '10px 20px', background: '#48bb78', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', height: '42px' }}>
            Add User
          </button>
        </form>
      </div>

      <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>Registered Users</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Email</th>
              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Role</th>
              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Added Date</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{user.email}</td>
                <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>
                  <span style={{ background: user.role === 'admin' ? '#ebf8ff' : '#f0fff4', color: user.role === 'admin' ? '#3182ce' : '#38a169', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>
                  {user.isFirstLogin === true ? "Pending Setup" : "Active"}
                </td>
                <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="4" style={{ padding: '15px', textAlign: 'center' }}>No users found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Employees;
