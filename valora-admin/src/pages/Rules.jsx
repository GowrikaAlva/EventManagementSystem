import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const Rules = () => {
  const [rules, setRules] = useState({ domains: [], keywords: [], customPatterns: [] });
  const [newDomain, setNewDomain] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const fetchRules = async () => {
    try {
      const res = await api.get('/rules');
      setRules({
        domains: res.data.domains || [],
        keywords: res.data.keywords || [],
        customPatterns: res.data.customPatterns || []
      });
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddDomain = async (e) => {
    e.preventDefault();
    try {
      await api.post('/rules/domain', { domain: newDomain });
      setNewDomain('');
      fetchRules();
    } catch(err) {}
  };

  const handleRemoveDomain = async (domain) => {
    try {
      await api.delete('/rules/domain', { data: { domain } });
      fetchRules();
    } catch(err) {}
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/rules/keyword', { keyword: newKeyword });
      setNewKeyword('');
      fetchRules();
    } catch(err) {}
  };

  const handleRemoveKeyword = async (keyword) => {
    try {
      await api.delete('/rules/keyword', { data: { keyword } });
      fetchRules();
    } catch(err) {}
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Detection Rules</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* DOMAINS */}
        <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Protected Domains</h3>
          
          <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="text" value={newDomain} onChange={e=>setNewDomain(e.target.value)} placeholder="@company.com" style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e0', borderRadius: '4px' }} required />
            <button type="submit" style={{ padding: '8px 15px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
          </form>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {rules.domains.map((d, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #edf2f7' }}>
                <span>{d}</span>
                <button onClick={() => handleRemoveDomain(d)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>

        {/* KEYWORDS */}
        <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Secret Keywords</h3>
          
          <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input type="text" value={newKeyword} onChange={e=>setNewKeyword(e.target.value)} placeholder="Project Falcon" style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e0', borderRadius: '4px' }} required />
            <button type="submit" style={{ padding: '8px 15px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
          </form>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {rules.keywords.map((k, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #edf2f7' }}>
                <span>{k}</span>
                <button onClick={() => handleRemoveKeyword(k)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Rules;
