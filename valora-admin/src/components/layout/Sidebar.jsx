import React from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/valora-logo.svg";
import { IconGrid, IconLogout, IconShield, IconUsers } from "./icons";

function NavItem({ to, icon, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link to={to} data-active={active ? "true" : "false"}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="Valora" />
        <div className="title">
          <strong>Valora Admin</strong>
          <span>Defend before you send</span>
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        <NavItem to="/" label="Overview" icon={<IconGrid />} />
        <NavItem to="/employees" label="Employees" icon={<IconUsers />} />
        <NavItem to="/rules" label="Rules" icon={<IconShield />} />
      </nav>

      <div className="sidebar__footer">
        <button className="btn" onClick={onLogout} type="button">
          <IconLogout style={{ marginRight: 8 }} />
          Logout
        </button>
      </div>
    </aside>
  );
}

