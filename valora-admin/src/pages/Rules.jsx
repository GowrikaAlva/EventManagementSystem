import React, { useEffect, useState } from "react";
import api from "../utils/api";

const Rules = () => {
  const [rules, setRules] = useState({ domains: [], keywords: [], customPatterns: [] });
  const [newDomain, setNewDomain] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await api.get('/rules');
      setRules({
        domains: res.data.companyRules?.domains || [],
        keywords: res.data.companyRules?.keywords || [],
        customPatterns: res.data.companyRules?.customPatterns || []
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
      setBusy(true);
      await api.post('/rules/domain', { domain: newDomain });
      setNewDomain('');
      fetchRules();
    } catch(err) {}
    finally { setBusy(false); }
  };

  const handleRemoveDomain = async (domain) => {
    try {
      setBusy(true);
      await api.delete('/rules/domain', { data: { domain } });
      fetchRules();
    } catch(err) {}
    finally { setBusy(false); }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      await api.post('/rules/keyword', { keyword: newKeyword });
      setNewKeyword('');
      fetchRules();
    } catch(err) {}
    finally { setBusy(false); }
  };

  const handleRemoveKeyword = async (keyword) => {
    try {
      setBusy(true);
      await api.delete('/rules/keyword', { data: { keyword } });
      fetchRules();
    } catch(err) {}
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid--2">
      <section className="card">
        <div className="card__head">
          <p className="card__title">Protected domains</p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddDomain} className="stack" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <div className="label">Domain pattern</div>
              <input
                className="input"
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="@company.com"
                required
              />
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                Add domain
              </button>
            </div>
          </form>

          <div style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th style={{ width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.domains.map((d, i) => (
                  <tr key={i}>
                    <td>{d}</td>
                    <td>
                      <button className="btn btn--danger" type="button" onClick={() => handleRemoveDomain(d)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.domains.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ color: "rgba(234,240,255,.65)" }}>
                      No domains configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <p className="card__title">Secret keywords</p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddKeyword} className="stack" style={{ alignItems: "flex-end" }}>
            <div className="field">
              <div className="label">Keyword</div>
              <input
                className="input"
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Project Falcon"
                required
              />
            </div>
            <div style={{ flex: "0 0 140px" }}>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                Add keyword
              </button>
            </div>
          </form>

          <div style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th style={{ width: 120 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.keywords.map((k, i) => (
                  <tr key={i}>
                    <td>{k}</td>
                    <td>
                      <button className="btn btn--danger" type="button" onClick={() => handleRemoveKeyword(k)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.keywords.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ color: "rgba(234,240,255,.65)" }}>
                      No keywords configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Rules;
