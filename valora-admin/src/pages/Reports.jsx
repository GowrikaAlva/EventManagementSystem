import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";

const Reports = () => {
  const [period, setPeriod] = useState("monthly");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await api.get(`/reports/generate?period=${period}`);
        if (res.data.success) {
          setReport(res.data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Report generation error", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    const interval = setInterval(() => {
      // Don't show loading state on background refresh
      api.get(`/reports/generate?period=${period}`).then(res => {
        if (res.data.success) setReport(res.data);
      }).catch(err => console.error(err));
    }, 5000);

    return () => clearInterval(interval);
  }, [period]);

  const handlePrint = () => {
    window.print();
  };

  const COLORS = ["#25e6d9", "rgba(255,176,32,0.8)", "rgba(255,77,77,0.7)"];

  return (
    <div className="grid" style={{ gap: 14 }}>
      <style>
        {`
          @media print {
            .sidebar, .topbar, .period-selector-section, .export-btn-section {
              display: none !important;
            }
            body {
              background: #fff !important;
              color: #000 !important;
            }
            .content {
              padding: 0 !important;
            }
            .card {
              border: 1px solid #ddd !important;
              background: #fff !important;
              box-shadow: none !important;
              color: #000 !important;
            }
            .card__title, .metric .value, .metric .hint, .table th, .table td {
              color: #000 !important;
            }
            .recharts-text {
              fill: #000 !important;
            }
            .recharts-cartesian-grid-line {
              stroke: #ddd !important;
            }
          }
        `}
      </style>

      {/* SECTION 1 — Period selector */}
      <section className="card period-selector-section">
        <div className="card__body" style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {["weekly", "monthly", "yearly"].map((p) => (
              <button
                key={p}
                className="btn"
                style={{
                  textTransform: "capitalize",
                  borderColor: period === p ? "rgba(37,230,217,0.8)" : "rgba(255,255,255,0.16)",
                }}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost export-btn-section" style={{ borderColor: "#25e6d9" }} onClick={handlePrint}>
            Download Report
          </button>
        </div>
      </section>

      {/* Error state */}
      {error && (
        <section className="card">
          <div className="card__body" style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
            Could not load report. Please try again.
          </div>
        </section>
      )}

      {/* SECTION 2 — Report panels */}
      {!error && report && (
        <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.2s" }} className="grid grid--2">
          
          {/* Panel A — Coverage */}
          <section className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card__head">
              <p className="card__title">Coverage</p>
            </div>
            <div className="card__body">
              <div className="grid grid--3" style={{ marginBottom: 20 }}>
                <div className="metric">
                  <div>
                    <div className="value">{report.coverage.active}</div>
                    <div className="hint">Active employees</div>
                  </div>
                </div>
                <div className="metric">
                  <div>
                    <div className="value">{report.coverage.inactive}</div>
                    <div className="hint">Inactive employees</div>
                  </div>
                </div>
                <div className="metric">
                  <div>
                    <div className="value">{report.coverage.notInstalled}</div>
                    <div className="hint">Not installed</div>
                  </div>
                </div>
              </div>
              
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Active", value: report.coverage.active },
                        { name: "Inactive", value: report.coverage.inactive },
                        { name: "Not Installed", value: report.coverage.notInstalled }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {
                        [
                          { name: "Active", value: report.coverage.active },
                          { name: "Inactive", value: report.coverage.inactive },
                          { name: "Not Installed", value: report.coverage.notInstalled }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))
                      }
                    </Pie>
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#12122a", borderColor: "#2a2a4a", color: "#e0e0f0", borderRadius: 8 }} itemStyle={{ color: "#e0e0f0" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Panel B — Platform Usage */}
          <section className="card">
            <div className="card__head">
              <p className="card__title">AI Platforms in Use</p>
            </div>
            <div className="card__body" style={{ height: 260 }}>
              {report.platformUsage && report.platformUsage.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.platformUsage} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                    <YAxis dataKey="platform" type="category" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} width={80} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} contentStyle={{ backgroundColor: "#12122a", borderColor: "#2a2a4a", color: "#e0e0f0", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#25e6d9" fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No platform usage data</div>
              )}
            </div>
          </section>

          {/* Panel C — Activity Timeline */}
          <section className="card">
            <div className="card__head">
              <p className="card__title">Daily Active Users</p>
            </div>
            <div className="card__body" style={{ height: 260 }}>
              {report.activityTimeline && report.activityTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={report.activityTimeline.map(d => ({ ...d, shortDate: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }))} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="shortDate" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#12122a", borderColor: "#2a2a4a", color: "#e0e0f0", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="activeUsers" stroke="#25e6d9" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#25e6d9", stroke: "#12122a" }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No timeline data</div>
              )}
            </div>
          </section>

          {/* Panel D — Top Active Employees */}
          <section className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card__head">
              <p className="card__title">Most Active Employees</p>
            </div>
            <div className="card__body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Days Active</th>
                    <th>Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topActiveEmployees && report.topActiveEmployees.map((emp, idx) => (
                    <tr key={idx}>
                      <td>{emp.email}</td>
                      <td>{emp.daysActive}</td>
                      <td style={{ color: "rgba(124,243,255,.92)" }}>{emp.platforms.join(", ")}</td>
                    </tr>
                  ))}
                  {(!report.topActiveEmployees || report.topActiveEmployees.length === 0) && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.4)" }}>
                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 8 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <br/>
                        No active employees found in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

export default Reports;
