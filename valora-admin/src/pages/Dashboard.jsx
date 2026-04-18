import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

function Sparkline({ points = [] }) {
  const d = useMemo(() => {
    if (!points.length) return "";
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = Math.max(1, max - min);
    const w = 140;
    const h = 44;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1 || 1)) * w;
        const y = h - ((p - min) / range) * h;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);

  return (
    <svg width="140" height="44" viewBox="0 0 140 44" aria-hidden="true">
      <path d={d} stroke="rgba(37,230,217,.95)" strokeWidth="2.2" fill="none" />
      <path d={d} stroke="rgba(124,243,255,.35)" strokeWidth="6" fill="none" />
    </svg>
  );
}

const Dashboard = () => {
  const [totalLeaks, setTotalLeaks] = useState(0);
  const [topUsers, setTopUsers] = useState([]);
  const [recentViolations, setRecentViolations] = useState([]);
  const [teamActivity, setTeamActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const leaksRes = await api.get('/analytics/total-leaks');
        if (leaksRes.data.success) setTotalLeaks(leaksRes.data.count);

        const usersRes = await api.get('/analytics/top-users');
        if (usersRes.data.success) setTopUsers(usersRes.data.topUsers);

        const recentRes = await api.get('/violations?limit=10');
        if (recentRes.data.success) setRecentViolations(recentRes.data.violations);

        const teamRes = await api.get('/activity/team');
        if (teamRes.data.success) setTeamActivity(teamRes.data.team);
      } catch (err) {
        console.error("Dashboard error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const spark = useMemo(() => {
    // purely UI: derive a stable pseudo-series from current data (no new backend endpoints)
    const seed = (totalLeaks || 7) + (topUsers?.length || 0) * 11 + (recentViolations?.length || 0) * 3;
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const n = Math.sin((i + 1) * 0.85 + seed) * 0.5 + 0.5;
      pts.push(Math.round(20 + n * 80));
    }
    return pts;
  }, [totalLeaks, topUsers, recentViolations]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid grid--3">
        <section className="card">
          <div className="card__head">
            <p className="card__title">Leaks prevented</p>
          </div>
          <div className="card__body metric">
            <div>
              <div className="value">{loading ? "—" : totalLeaks}</div>
              <div className="hint">Policy enforcement across all monitored endpoints</div>
            </div>
            <Sparkline points={spark} />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <p className="card__title">Recent incidents</p>
          </div>
          <div className="card__body">
            <div className="metric" style={{ alignItems: "center", marginTop: 4 }}>
              <div>
                <div className="value">{loading ? "—" : recentViolations.length}</div>
                <div className="hint">Latest events from the violations stream</div>
              </div>
              <div className="badge badge--active">Live</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <p className="card__title">Employee Status</p>
          </div>
          <div className="card__body">
            <div className="metric" style={{ alignItems: "center", marginTop: 4 }}>
              <div>
                <div className="value">{loading ? "—" : `${teamActivity.filter(e => e.status === "active").length} / ${teamActivity.length}`}</div>
                <div className="hint">Active employees currently monitored</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid--2">
        <section className="card">
          <div className="card__head">
            <p className="card__title">Top offenders</p>
          </div>
          <div className="card__body">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Violations</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((user, idx) => (
                  <tr key={idx}>
                    <td>{user.email}</td>
                    <td>{user.violationCount}</td>
                  </tr>
                ))}
                {topUsers.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.4)" }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 8 }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                      <br/>
                      No user data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <p className="card__title">Recent violations</p>
          </div>
          <div className="card__body">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>URL</th>
                  <th>Types</th>
                </tr>
              </thead>
              <tbody>
                {recentViolations.map((v, idx) => (
                  <tr key={idx}>
                    <td>{new Date(v.timestamp).toLocaleString()}</td>
                    <td style={{ color: "rgba(124,243,255,.92)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.url}
                    </td>
                    <td>{(v.matches || []).map((m) => m.type).join(", ")}</td>
                  </tr>
                ))}
                {recentViolations.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.4)" }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 8 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                      <br/>
                      All clear. No violations detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <p className="card__title">Employee Extension Status</p>
        </div>
        <div className="card__body">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {teamActivity.map((emp, idx) => {
                let badgeClass = "badge";
                let statusText = "Not Installed";
                let customStyle = { borderColor: "rgba(255,77,77,.35)", background: "rgba(255,77,77,.10)", color: "rgba(255,77,77,.9)" };

                if (emp.status === "active") {
                  badgeClass = "badge badge--active";
                  statusText = "Active";
                  customStyle = {}; // relies on badge--active class
                } else if (emp.status === "inactive") {
                  statusText = "Inactive";
                  customStyle = { borderColor: "rgba(255,176,32,.35)", background: "rgba(255,176,32,.10)", color: "rgba(255,176,32,.9)" };
                }

                return (
                  <tr key={idx}>
                    <td>{emp.email}</td>
                    <td>
                      <span className={badgeClass} style={customStyle}>
                        {statusText}
                      </span>
                    </td>
                    <td>{emp.lastActive ? new Date(emp.lastActive).toLocaleString() : "Never"}</td>
                  </tr>
                );
              })}
              {teamActivity.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.4)" }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 8 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <br/>
                    Add employees to monitor coverage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
