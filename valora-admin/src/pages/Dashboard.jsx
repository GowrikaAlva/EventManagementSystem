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
      } catch (err) {
        console.error("Dashboard error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
            <p className="card__title">Top offenders</p>
          </div>
          <div className="card__body">
            <div className="metric" style={{ alignItems: "center" }}>
              <div>
                <div className="value">{loading ? "—" : topUsers.length}</div>
                <div className="hint">Users with repeated policy violations</div>
              </div>
              <div className="badge" style={{ borderColor: "rgba(255,176,32,.35)", background: "rgba(255,176,32,.10)" }}>
                Watchlist
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <p className="card__title">Recent incidents</p>
          </div>
          <div className="card__body">
            <div className="metric" style={{ alignItems: "center" }}>
              <div>
                <div className="value">{loading ? "—" : recentViolations.length}</div>
                <div className="hint">Latest events from the violations stream</div>
              </div>
              <div className="badge badge--active">Live</div>
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
                    <td colSpan={2} style={{ color: "rgba(234,240,255,.65)" }}>
                      No user data
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
                    <td colSpan={3} style={{ color: "rgba(234,240,255,.65)" }}>
                      No violations reported
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
