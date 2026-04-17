import React, { useEffect, useState } from "react";
import api from "../utils/api";

const Employees = () => {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if(res.data.success) setUsers(res.data.users);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
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
    <div className="grid" style={{ gap: 14 }}>
      <section className="card">
        <div className="card__head">
          <p className="card__title">Provision access</p>
        </div>
        <div className="card__body">
          {error && <div className="toast toast--err" style={{ marginBottom: 12 }}>{error}</div>}
          {success && <div className="toast toast--ok" style={{ marginBottom: 12 }}>{success}</div>}

          <form onSubmit={handleAddEmployee} className="stack">
            <div className="field">
              <div className="label">Email address</div>
              <input
                className="input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="jane@company.com"
              />
            </div>

            <div className="field" style={{ flex: "0 0 180px" }}>
              <div className="label">Role</div>
              <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ flex: "0 0 140px" }}>
              <button className="btn btn--primary" type="submit">
                Add user
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <p className="card__title">Directory</p>
        </div>
        <div className="card__body">
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === "admin" ? "badge--admin" : "badge--employee"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.isFirstLogin === true ? "badge--pending" : "badge--active"}`}>
                      {user.isFirstLogin === true ? "Pending setup" : "Active"}
                    </span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "rgba(234,240,255,.65)" }}>
                    No users found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} style={{ color: "rgba(234,240,255,.65)" }}>
                    Loading…
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

export default Employees;
