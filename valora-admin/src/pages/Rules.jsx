import React, { useEffect, useState } from "react";
import api from "../utils/api";

const NUMBER_TYPE_LABELS = {
  phone:          "Phone / Contact No.",
  account_number: "Account Number",
  tax_id:         "Tax ID",
  other:          "Other",
};

const EMPTY_APIKEY = { label: "", value: "" };
const EMPTY_NUMBER = { label: "", type: "phone", value: "" };

const Rules = () => {
  const [rules, setRules] = useState({
    domains: [], keywords: [], customPatterns: [], apiKeys: [], sensitiveNumbers: [],
  });
  const [newDomain,  setNewDomain]  = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newApiKey,  setNewApiKey]  = useState(EMPTY_APIKEY);
  const [newNumber,  setNewNumber]  = useState(EMPTY_NUMBER);
  const [busy, setBusy] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await api.get("/rules");
      setRules({
        domains:          res.data.companyRules?.domains          || [],
        keywords:         res.data.companyRules?.keywords         || [],
        customPatterns:   res.data.companyRules?.customPatterns   || [],
        apiKeys:          res.data.companyRules?.apiKeys          || [],
        sensitiveNumbers: res.data.companyRules?.sensitiveNumbers || [],
      });
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchRules(); }, []);

  const wrap = (fn) => async (...args) => {
    try {
      setBusy(true);
      await fn(...args);
      await fetchRules();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDomain  = wrap(async (e) => { e.preventDefault(); await api.post("/rules/domain",  { domain:  newDomain  }); setNewDomain("");  });
  const handleAddKeyword = wrap(async (e) => { e.preventDefault(); await api.post("/rules/keyword", { keyword: newKeyword }); setNewKeyword(""); });
  const handleAddApiKey  = wrap(async (e) => { e.preventDefault(); await api.post("/rules/apikey",  newApiKey); setNewApiKey(EMPTY_APIKEY); });
  const handleAddNumber  = wrap(async (e) => { e.preventDefault(); await api.post("/rules/number",  newNumber); setNewNumber(EMPTY_NUMBER); });

  const handleRemoveDomain  = wrap((domain)  => api.delete("/rules/domain",        { data: { domain  } }));
  const handleRemoveKeyword = wrap((keyword) => api.delete("/rules/keyword",       { data: { keyword } }));
  const handleRemoveApiKey  = wrap((id)      => api.delete(`/rules/apikey/${id}`));
  const handleRemoveNumber  = wrap((id)      => api.delete(`/rules/number/${id}`));

  /* ── shared row style used by all 4 forms ── */
  const formRow = {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    flexWrap: "wrap",
  };
  const fieldGrow  = { display: "flex", flexDirection: "column", gap: 6, flex: "1 1 150px" };
  const fieldFixed = { display: "flex", flexDirection: "column", gap: 6, flex: "1 1 130px" };
  const btnWrap    = { flex: "0 0 110px" };
  const btnFull    = { width: "100%", height: 42 };

  return (
    <div className="grid grid--2">

      {/* ── Protected Domains ── */}
      <section className="card">
        <div className="card__head">
          <p className="card__title">Protected domains</p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddDomain}>
            <div style={formRow}>
              <div style={fieldGrow}>
                <div className="label">Domain pattern</div>
                <input className="input" type="text" value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="@company.com" required />
              </div>
              <div style={btnWrap}>
                <button className="btn btn--primary" type="submit"
                  disabled={busy} style={btnFull}>
                  Add domain
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.domains.map((d, i) => (
                  <tr key={i}>
                    <td>{d}</td>
                    <td>
                      <button className="btn btn--danger" type="button"
                        onClick={() => handleRemoveDomain(d)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.domains.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "rgba(234,240,255,.45)" }}>No domains configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Secret Keywords ── */}
      <section className="card">
        <div className="card__head">
          <p className="card__title">Secret keywords</p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddKeyword}>
            <div style={formRow}>
              <div style={fieldGrow}>
                <div className="label">Keyword</div>
                <input className="input" type="text" value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Project Falcon" required />
              </div>
              <div style={btnWrap}>
                <button className="btn btn--primary" type="submit"
                  disabled={busy} style={btnFull}>
                  Add keyword
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.keywords.map((k, i) => (
                  <tr key={i}>
                    <td>{k}</td>
                    <td>
                      <button className="btn btn--danger" type="button"
                        onClick={() => handleRemoveKeyword(k)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.keywords.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "rgba(234,240,255,.45)" }}>No keywords configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── API Keys ── */}
      <section className="card">
        <div className="card__head">
          <p className="card__title">API keys</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(234,240,255,.40)" }}>
            Encrypted AES-256-GCM · only last 4 chars shown
          </p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddApiKey}>
            <div style={formRow}>
              <div style={fieldFixed}>
                <div className="label">Label</div>
                <input className="input" type="text" value={newApiKey.label}
                  onChange={(e) => setNewApiKey((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Stripe Live Key" required />
              </div>
              <div style={fieldGrow}>
                <div className="label">Key value</div>
                <input className="input" type="password" value={newApiKey.value}
                  onChange={(e) => setNewApiKey((s) => ({ ...s, value: e.target.value }))}
                  placeholder="sk_live_••••••••" required />
              </div>
              <div style={btnWrap}>
                <button className="btn btn--primary" type="submit"
                  disabled={busy} style={btnFull}>
                  Add key
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Hint</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.apiKeys.map((k) => (
                  <tr key={k._id}>
                    <td>{k.label}</td>
                    <td style={{ fontFamily: "var(--mono)", letterSpacing: 2, color: "rgba(234,240,255,.55)" }}>
                      ••••{k.hint}
                    </td>
                    <td>
                      <button className="btn btn--danger" type="button"
                        onClick={() => handleRemoveApiKey(k._id)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.apiKeys.length === 0 && (
                  <tr><td colSpan={3} style={{ color: "rgba(234,240,255,.45)" }}>No API keys configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Sensitive Numbers ── */}
      <section className="card">
        <div className="card__head">
          <p className="card__title">Contact &amp; account numbers</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(234,240,255,.40)" }}>
            Encrypted AES-256-GCM · only last 4 digits shown
          </p>
        </div>
        <div className="card__body">
          <form onSubmit={handleAddNumber}>
            <div style={formRow}>
              <div style={fieldFixed}>
                <div className="label">Label</div>
                <input className="input" type="text" value={newNumber.label}
                  onChange={(e) => setNewNumber((s) => ({ ...s, label: e.target.value }))}
                  placeholder="Support Hotline" required />
              </div>
              <div style={{ ...fieldFixed, flex: "0 1 148px" }}>
                <div className="label">Type</div>
                <select className="input" value={newNumber.type}
                  onChange={(e) => setNewNumber((s) => ({ ...s, type: e.target.value }))}>
                  {Object.entries(NUMBER_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div style={fieldFixed}>
                <div className="label">Value</div>
                <input className="input" type="password" value={newNumber.value}
                  onChange={(e) => setNewNumber((s) => ({ ...s, value: e.target.value }))}
                  placeholder="+91 98765 43210" required />
              </div>
              <div style={btnWrap}>
                <button className="btn btn--primary" type="submit"
                  disabled={busy} style={btnFull}>
                  Add
                </button>
              </div>
            </div>
          </form>

          <div style={{ marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Hint</th>
                  <th style={{ width: 100 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.sensitiveNumbers.map((n) => (
                  <tr key={n._id}>
                    <td>{n.label}</td>
                    <td style={{ color: "rgba(234,240,255,.65)" }}>{NUMBER_TYPE_LABELS[n.type] ?? n.type}</td>
                    <td style={{ fontFamily: "var(--mono)", letterSpacing: 2, color: "rgba(234,240,255,.55)" }}>
                      ••••{n.hint}
                    </td>
                    <td>
                      <button className="btn btn--danger" type="button"
                        onClick={() => handleRemoveNumber(n._id)} disabled={busy}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.sensitiveNumbers.length === 0 && (
                  <tr><td colSpan={4} style={{ color: "rgba(234,240,255,.45)" }}>No numbers configured</td></tr>
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