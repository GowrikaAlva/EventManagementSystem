import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import logo from "../assets/valora-logo.svg";

const AdminRegister = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setBusy(true);
      setError("");
      // the backend currently doesn't use fullName but we can send it anyway or add it later
      const res = await api.post('/auth/admin-register', { email, password, fullName });
      if (res.data.success && res.data.token) {
        sessionStorage.setItem('valoraAdminToken', res.data.token);
        navigate('/'); // Redirect to dashboard which is mapped to "/"
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__panel" style={{ maxWidth: 1000 }}>
        <section className="auth__left" style={{ paddingRight: 40 }}>
          <div className="auth__logo">
            <img src={logo} alt="Valora" />
            <div>
              <strong>Valora</strong>
              <span>Defend before you send</span>
            </div>
          </div>

          <h2 className="auth__headline">Create your organization</h2>
          <p className="auth__copy">
            Deploy Valora across your company to monitor violations and manage employee access with enterprise-grade controls.
          </p>

          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Select a Plan
            </h3>
            
            <div className="grid grid--2" style={{ gap: 12 }}>
              <div className="card" style={{ background: "rgba(255,255,255,.05)", boxShadow: "none", opacity: 0.6, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <span className="badge" style={{ borderColor: "rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#aaa" }}>Coming Soon</span>
                </div>
                <div className="card__body">
                  <p className="card__title" style={{ fontSize: 16 }}>Starter</p>
                  <div style={{ fontSize: 24, fontWeight: 700, margin: "8px 0" }}>Free</div>
                  <p style={{ color: "rgba(234,240,255,.72)", fontSize: 12 }}>
                    Up to 5 employees. Basic keyword & domain rules.
                  </p>
                </div>
              </div>

              <div className="card" style={{ background: "rgba(37,230,217,.05)", border: "1px solid rgba(37,230,217,.2)", boxShadow: "none", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                   <span className="badge" style={{ borderColor: "rgba(37,230,217,.35)", background: "rgba(37,230,217,.10)" }}>Popular</span>
                </div>
                <div className="card__body">
                  <p className="card__title" style={{ fontSize: 16, color: "#25E6D9" }}>Pro</p>
                  <div style={{ fontSize: 24, fontWeight: 700, margin: "8px 0" }}>
                    $12{" "}
                    <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(234,240,255,.55)" }}>(₹1,114)</span>
                    <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(234,240,255,.55)" }}>/mo</span>
                  </div>
                  <p style={{ color: "rgba(234,240,255,.72)", fontSize: 12 }}>
                    Unlimited employees. Regex rules & alerts.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="card" style={{ background: "rgba(255,255,255,.05)", boxShadow: "none", opacity: 0.6, position: "relative", overflow: "hidden", marginTop: 12 }}>
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <span className="badge" style={{ borderColor: "rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#aaa" }}>Coming Soon</span>
              </div>
              <div className="card__body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p className="card__title" style={{ fontSize: 16 }}>Enterprise</p>
                  <p style={{ color: "rgba(234,240,255,.72)", fontSize: 12, marginTop: 4 }}>
                    SSO, custom integrations & dedicated support.
                  </p>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Custom</div>
              </div>
            </div>
          </div>
        </section>

        <section className="auth__right">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: "rgba(234,240,255,.75)" }}>Get started</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.4px" }}>Register</div>
            </div>
            <span className="badge" style={{ borderColor: "rgba(37,230,217,.35)", background: "rgba(37,230,217,.10)" }}>
              Admin
            </span>
          </div>

          {error && <div className="toast toast--err" style={{ marginTop: 14 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ marginTop: 14 }} className="grid" aria-label="Admin register">
            <div className="field">
              <div className="label">Full Name</div>
              <input
                className="input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                required
                autoComplete="name"
              />
            </div>

            <div className="field">
              <div className="label">Company Email</div>
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

            <div className="grid grid--2" style={{ gap: 16 }}>
              <div className="field">
                <div className="label">Password</div>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="field">
                <div className="label">Confirm Password</div>
                <input
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button className="btn btn--primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? "Creating account…" : "Create organization"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <p style={{ margin: 0, color: "rgba(234,240,255,.55)", fontSize: 12 }}>
                Already have an account? <Link to="/login" style={{ color: "#25E6D9", textDecoration: "none" }}>Log in here</Link>
              </p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminRegister;