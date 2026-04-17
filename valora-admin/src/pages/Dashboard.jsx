import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const Dashboard = () => {
  const [totalLeaks, setTotalLeaks] = useState(0);
  const [topUsers, setTopUsers] = useState([]);
  const [recentViolations, setRecentViolations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaksRes = await api.get('/analytics/total-leaks');
        if (leaksRes.data.success) setTotalLeaks(leaksRes.data.count);

        const usersRes = await api.get('/analytics/top-users');
        if (usersRes.data.success) setTopUsers(usersRes.data.topUsers);

        const recentRes = await api.get('/violations?limit=10');
        if (recentRes.data.success) setRecentViolations(recentRes.data.violations);
      } catch (err) {
        console.error("Dashboard error", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Dashboard Overview</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#718096', fontSize: '14px', marginBottom: '10px' }}>TOTAL LEAKS PREVENTED</h3>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#2d3748' }}>{totalLeaks}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '30px' }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#2d3748' }}>Top Offenders</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Email</th>
                <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Violations</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{user.email}</td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{user.violationCount}</td>
                </tr>
              ))}
              {topUsers.length === 0 && <tr><td colSpan="2" style={{ padding: '15px' }}>No user data</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#2d3748' }}>Recent Violations</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#edf2f7', textAlign: 'left' }}>
                <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>URL</th>
                <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>Types</th>
              </tr>
            </thead>
            <tbody>
              {recentViolations.map((v, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{new Date(v.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#3182ce' }}>{v.url}</td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>{v.matches.map(m=>m.type).join(', ')}</td>
                </tr>
              ))}
              {recentViolations.length === 0 && <tr><td colSpan="3" style={{ padding: '15px' }}>No violations reported</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
