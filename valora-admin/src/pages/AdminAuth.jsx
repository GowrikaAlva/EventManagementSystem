import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import logo from "../assets/valora-logo.svg";

const AdminAuth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setBusy(true);
      const res = await api.post('/auth/admin', { email, password });
      if (res.data.success && res.data.token) {
        localStorage.setItem('valoraAdminToken', res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <section className="auth__left">
          <div className="auth__logo">
            <img src={logo} alt="Valora" />
            <div>
              <strong>Valora</strong>
              <span>Defend before you send</span>
            </div>
          </div>

          <h2 className="auth__headline">Company-grade data leak prevention dashboard</h2>
          <p className="auth__copy">
            Monitor violations, manage employee access, and tune detection rules — all with a security-first UX.
          </p>

          <div style={{ marginTop: 18 }} className="grid grid--2">
            <div className="card" style={{ background: "rgba(255,255,255,.05)", boxShadow: "none" }}>
              <div className="card__body">
                <p className="card__title">Real-time visibility</p>
                <p style={{ marginTop: 8, color: "rgba(234,240,255,.72)", fontSize: 13 }}>
                  Keep teams compliant with clear incident timelines and offender signals.
                </p>
              </div>
            </div>
            <div className="card" style={{ background: "rgba(255,255,255,.05)", boxShadow: "none" }}>
              <div className="card__body">
                <p className="card__title">Rule controls</p>
                <p style={{ marginTop: 8, color: "rgba(234,240,255,.72)", fontSize: 13 }}>
                  Protect domains and keywords with fast, low-friction configuration.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="auth__right">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: "rgba(234,240,255,.75)" }}>Sign in</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.4px" }}>Admin access</div>
            </div>
            <span className="badge" style={{ borderColor: "rgba(37,230,217,.35)", background: "rgba(37,230,217,.10)" }}>
              Secure
            </span>
          </div>

          {error && <div className="toast toast--err" style={{ marginTop: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ marginTop: 14 }} className="grid" aria-label="Admin login">
            <div className="field">
              <div className="label">Email</div>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <div className="label">Password</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Continue"}
            </button>

            <p style={{ margin: 0, color: "rgba(234,240,255,.55)", fontSize: 12 }}>
              By continuing you agree to your organization’s security policies.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminAuth;
